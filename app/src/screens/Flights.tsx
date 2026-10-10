// Flight records (D-022, D-024, D-027), laid out as the Claude Design
// wireframes WF-C2 (Flight records), WF-H1 (Log flight hours) and WF-FR1
// (Correct flight record), plus the brought-forward totals entry.
//
// All on the one /flights address, chosen by the web address:
//   ?aircraft=<id>                          the tail's flight records (WF-C2)
//   ?aircraft=<id>&do=log                   log flight hours (WF-H1)
//   ?aircraft=<id>&record=<id>              one record's version history
//   ?aircraft=<id>&record=<id>&do=correct   correct it: new version (WF-FR1)
//   ?aircraft=<id>&do=baseline              brought-forward totals (Engineering)
//
// Who does what (checked again by the database, D-125):
//   Pilots (Operations) and Engineering log flights, tails in scope (D-027).
//   Only Engineering corrects (a new version with a reason and PIN; the
//   original stays in history, D-023) and enters the brought-forward totals.
//   Command and Quality read everything; Supply and Procurement see totals only.
// Totals are the sum of what people entered. Nothing is forecast (D-020 to D-022).
// Offline, a logged flight waits in the send queue (D-103); corrections and
// the brought-forward totals need a connection (PIN, D-104).
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { anyActions, anyDb, errorText } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { perform, queuedText } from '../lib/perform';
import { formatDateTime, formatPlainDate } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { DateField } from '../components/DateField';
import { PinField } from '../components/PinField';
import { PageHead, Section } from '../components/PageFrame';
import { Message, PendingBanner, TailTop } from './Ddls';
import { TotalsFacts, basisLabel, formatCount, formatHours, useAircraftTotals } from './flights/totals';
import '../styles/p2-flights.css';

export { useAircraftTotals, useFleetTotals, TotalsFacts, formatHours, formatCount } from './flights/totals';

export type FlightRecord = {
  id: string; record_id: string; version: number; supersedes: string | null; kind: 'flight' | 'baseline';
  aircraft_id: string; flight_date: string; from_place: string | null; to_place: string | null;
  hours: number; hours_basis: string; cycles: number; landings: number;
  apu_hours: number | null; apu_cycles: number | null; log_ref: string | null; reason: string | null;
  is_void: boolean; entered_at: string; device_time: string | null;
  enterer: { three_letter_code: string; full_name: string } | null;
};

const SELECT = `id, record_id, version, supersedes, kind, aircraft_id, flight_date, from_place, to_place,
  hours, hours_basis, cycles, landings, apu_hours, apu_cycles, log_ref, reason, is_void, entered_at, device_time,
  enterer:entered_by (three_letter_code, full_name)`;

const FLIGHT_ACTIONS = ['log_flight'];
const PAGE = 60;

// crypto.randomUUID only works on https or localhost; a phone on plain http
// over the Wi-Fi needs the fallback.
function newRef(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
function cleanRow(r: FlightRecord): FlightRecord {
  return { ...r, hours: Number(r.hours), apu_hours: num(r.apu_hours), apu_cycles: num(r.apu_cycles) };
}

// All versions of every record on one tail, grouped: the newest version of
// each record (what the totals count) and how many versions it has.
function useFlightRecords(aircraftId: string) {
  const [rows, setRows] = useState<FlightRecord[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!aircraftId) return;
    const r = await cached(`flights:${aircraftId}`, () => anyDb.from('flight_record').select(SELECT)
      .eq('aircraft_id', aircraftId).order('flight_date', { ascending: false }).order('entered_at', { ascending: false }));
    if (r.error) return setError(errorText(r.error));
    setError('');
    setRows(((r.data ?? []) as FlightRecord[]).map(cleanRow));
  }, [aircraftId]);
  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const all = rows ?? [];
    const superseded = new Set(all.map((r) => r.supersedes).filter(Boolean) as string[]);
    const versions = new Map<string, FlightRecord[]>();
    all.forEach((r) => versions.set(r.record_id, [...(versions.get(r.record_id) ?? []), r]));
    versions.forEach((list) => list.sort((a, b) => a.version - b.version));
    const current = all.filter((r) => !superseded.has(r.id));
    return {
      flights: current.filter((r) => r.kind === 'flight'),
      baseline: current.find((r) => r.kind === 'baseline') ?? null,
      versions,
    };
  }, [rows]);
  return { rows, error, load, ...grouped };
}

const route = (aircraftId: string, extra?: { record?: string; do?: string }) => {
  const p = new URLSearchParams({ aircraft: aircraftId });
  if (extra?.record) p.set('record', extra.record);
  if (extra?.do) p.set('do', extra.do);
  return `/flights?${p.toString()}`;
};

// ============================================================ the screen ===
export function Flights() {
  const { me } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [params, setParams] = useSearchParams();
  const tailId = params.get('aircraft') || aircraft[0]?.id || '';
  const recordId = params.get('record');
  const doing = params.get('do');
  const tail = aircraft.find((a) => a.id === tailId);
  const [message, setMessage] = useState('');
  const data = useFlightRecords(tailId);
  const { totals, reload: reloadTotals } = useAircraftTotals(tailId);

  const deps = me?.departments.map((d) => d.code) ?? [];
  const isEngineer = deps.includes('ENG');
  const canLog = isEngineer || deps.includes('OPS');
  const canRead = canLog || Boolean(me?.isOversight);

  const go = (extra?: { record?: string; do?: string }) => {
    setParams(new URLSearchParams(route(tailId, extra).split('?')[1]));
    window.scrollTo(0, 0);
  };
  const done = async (m: string, extra?: { record?: string; do?: string }) => {
    setMessage(m);
    await data.load();
    reloadTotals();
    go(extra);
  };

  if (!tailId) return <div className="page"><p className="muted">No aircraft in your scope.</p></div>;
  const listCrumb = { label: 'Flight records', to: route(tailId) };
  const listBack = { to: route(tailId), label: 'Flight records' };

  // ----- log flight hours (WF-H1)
  if (doing === 'log') {
    return (
      <div className="page fr-page">
        <TailTop aircraftId={tailId} tail={tail?.tail} here={[listCrumb, { label: 'Log flight hours' }]} back={listBack} full={false} />
        <PageHead title={<>Log flight hours · <span className="mono">{tail?.tail}</span></>}
          sub="Totals update by adding this entry · APU totals update only from the APU fields · corrections create a new version" />
        {canLog
          ? <LogFlightForm aircraft={aircraft} aircraftId={tailId} basis={totals?.hours_basis}
              baselineAsAt={data.baseline && !data.baseline.is_void ? data.baseline.flight_date : null}
              onDone={(m) => done(m)} onCancel={() => go()} />
          : <p className="muted">Flight records are entered by pilots (Operations) and Engineering (D-027).</p>}
      </div>
    );
  }

  // ----- brought-forward totals (Engineering)
  if (doing === 'baseline') {
    return (
      <div className="page fr-page">
        <TailTop aircraftId={tailId} tail={tail?.tail} here={[listCrumb, { label: 'Brought-forward totals' }]} back={listBack} full={false} />
        <PageHead title={<>Brought-forward totals · <span className="mono">{tail?.tail}</span></>}
          sub="The totals from the paper records, as at a date · entered once by Engineering with a reason and PIN" />
        {!isEngineer ? <p className="muted">Only Engineering enters brought-forward totals (D-027).</p>
          : data.baseline ? (
            <p>This tail already has brought-forward totals (as at {formatPlainDate(data.baseline.flight_date)}).{' '}
              <Link to={route(tailId, { record: data.baseline.id, do: 'correct' })}>Correct them</Link> to change them (new version, D-023).</p>
          ) : <BaselineForm aircraftId={tailId} firstFlight={data.flights.filter((f) => !f.is_void).at(-1)?.flight_date ?? null}
                onDone={(m) => done(m)} onCancel={() => go()} />}
      </div>
    );
  }

  // ----- one record: version history, or correct (WF-FR1)
  if (recordId) {
    const row = data.rows?.find((r) => r.id === recordId);
    const versions = row ? data.versions.get(row.record_id) ?? [] : [];
    const newest = versions.at(-1);
    const name = row ? (row.kind === 'baseline' ? 'Brought-forward totals' : `Flight ${formatPlainDate(row.flight_date)}`) : 'Record';
    const correcting = doing === 'correct';
    return (
      <div className="page fr-page">
        <TailTop aircraftId={tailId} tail={tail?.tail}
          here={[listCrumb, ...(correcting ? [{ label: 'Correct flight record' }] : [{ label: name }])]}
          back={correcting ? { to: route(tailId, { record: recordId }), label: 'Version history' } : listBack} full={false} />
        {!data.rows ? <p className="muted">Loading…</p> : !row || !newest ? <p>This record is not on {tail?.tail ?? 'this tail'}.</p> : (
          <>
            <PageHead
              title={correcting ? 'Correct flight record' : <>{name} · <span className="mono">{tail?.tail}</span></>}
              sub={<><span className="mono">{tail?.tail}</span> · {formatPlainDate(versions[0].flight_date)} · logged by {who(versions[0])}
                {versions.length > 1 && <> · {versions.length} versions</>}</>}>
              {!correcting && isEngineer && (
                <Link className="button" to={route(tailId, { record: newest.id, do: 'correct' })}>Correct entry</Link>
              )}
            </PageHead>
            <Message text={message} />
            {correcting && (
              isEngineer
                ? <CorrectForm current={newest} original={versions[0]}
                    onDone={(m, id) => done(m, { record: id })} onCancel={() => go({ record: newest.id })} />
                : <p className="muted">Only Engineering corrects flight records (D-027).</p>
            )}
            <Section title="Version history" id="versions">
              <VersionTable versions={versions} />
              <p className="small muted" style={{ margin: 0 }}>Every version is kept. The newest one counts in the totals (D-023).</p>
            </Section>
          </>
        )}
      </div>
    );
  }

  // ----- the list (WF-C2)
  return (
    <div className="page fr-page">
      <TailTop aircraftId={tailId} tail={tail?.tail} here={[{ label: 'Flight records' }]}
        back={{ to: `/aircraft/${tailId}`, label: `${tail?.tail ?? 'aircraft'} overview` }} />
      <PageHead title={<>Flight records · <span className="mono">{tail?.tail}</span></>}
        sub="Totals are the sum of entered flights · APU values only when entered">
        {canLog && <Link className="button" to={route(tailId, { do: 'log' })}>Log flight hours</Link>}
        {isEngineer && !data.baseline && <Link className="button outline-button" to={route(tailId, { do: 'baseline' })}>Enter brought-forward totals</Link>}
        <AircraftPicker aircraft={aircraft} value={tailId}
          onChange={(v) => v && setParams(new URLSearchParams({ aircraft: v }), { replace: true })} placeholder="Choose a tail" />
      </PageHead>
      <Message text={message} />
      <PendingBanner aircraftId={tailId} actionNames={FLIGHT_ACTIONS} />

      <Section title="Totals">
        <TotalsFacts totals={totals} aircraftId={tailId} showLink={false} />
        {totals?.apu_hours != null && (
          <p className="small muted fr-apu">APU: <span className="mono">{formatHours(totals.apu_hours)}</span> h ·{' '}
            <span className="mono">{formatCount(totals.apu_cycles)}</span> cycles (sum of entered APU figures)</p>
        )}
        {isEngineer && totals && !totals.has_baseline && (
          <p className="small muted fr-apu">No brought-forward totals yet: the totals start from zero until Engineering enters the figures from the paper records.</p>
        )}
      </Section>

      {!canRead ? (
        <p className="muted">Flight records are kept by Operations and Engineering. You see the totals only (D-120).</p>
      ) : data.error ? <div className="error" role="alert">{data.error}</div>
        : !data.rows ? <p className="muted">Loading…</p>
        : <FlightTable flights={data.flights} baseline={data.baseline} versions={data.versions}
            aircraftId={tailId} isEngineer={isEngineer} basis={totals?.hours_basis} />}
    </div>
  );
}

const who = (r: FlightRecord) => r.enterer?.three_letter_code ?? '—';

// ------------------------------------------------------- the table (C2) ---
function FlightTable({ flights, baseline, versions, aircraftId, isEngineer, basis }: {
  flights: FlightRecord[]; baseline: FlightRecord | null; versions: Map<string, FlightRecord[]>;
  aircraftId: string; isEngineer: boolean; basis?: string;
}) {
  const { display } = useAuth();
  const [shown, setShown] = useState(PAGE);
  const list = flights.slice(0, shown);
  if (flights.length === 0 && !baseline) {
    return <div className="box"><div className="box-body"><p className="muted">No flight records on this tail yet.</p></div></div>;
  }
  const row = (r: FlightRecord, isBase = false) => {
    const n = versions.get(r.record_id)?.length ?? 1;
    return (
      <tr key={r.id} className={`${r.is_void ? 'fr-void' : ''}${isBase ? ' fr-base' : ''}`}>
        <td className="mono">{isBase ? <>As at {formatPlainDate(r.flight_date, display)}</> : formatPlainDate(r.flight_date, display)}
          {isBase && <div className="small">Brought forward</div>}</td>
        <td className="mono">{isBase ? '—' : [r.from_place, r.to_place].filter(Boolean).join(' → ') || '—'}</td>
        <td className="mono num">{formatHours(r.hours)}</td>
        <td className="mono num">{formatCount(r.cycles)}</td>
        <td className="mono num">{formatCount(r.landings)}</td>
        <td className="mono num">{formatHours(r.apu_hours)}</td>
        <td className="mono num">{formatCount(r.apu_cycles)}</td>
        <td className="mono small">{r.log_ref ?? '—'}</td>
        <td><span className="mono">{who(r)}</span> · <span className="mono small">{formatDateTime(r.entered_at, display)}</span>
          {r.is_void && <div><span className="chip tone-grey">Entered in error · not counted</span></div>}</td>
        {isEngineer && <td><Link to={route(aircraftId, { record: r.id, do: 'correct' })}>Correct entry</Link></td>}
        <td><Link to={route(aircraftId, { record: r.id })}>{n} version{n === 1 ? '' : 's'}</Link></td>
      </tr>
    );
  };
  return (
    <div className="box">
      <div className="table-scroll">
        <table className="ptable fr-table">
          <thead>
            <tr>
              <th>Date</th><th>From → To</th><th className="num">{basisLabel(basis)}</th><th className="num">Cycles</th>
              <th className="num">Landings</th><th className="num">APU hours</th><th className="num">APU cycles</th>
              <th>Log ref</th><th>Entered by</th>{isEngineer && <th>Correct</th>}<th>Version history</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => row(r))}
            {baseline && shown >= flights.length && row(baseline, true)}
          </tbody>
        </table>
      </div>
      {flights.length > shown && (
        <div className="box-body"><button type="button" className="outline-button" onClick={() => setShown((s) => s + PAGE)}>
          Show older ({flights.length - shown} more)</button></div>
      )}
    </div>
  );
}

function VersionTable({ versions }: { versions: FlightRecord[] }) {
  const { display } = useAuth();
  return (
    <div className="table-scroll">
      <table className="ptable fr-table">
        <thead><tr><th>Version</th><th>Date</th><th className="num">Hours</th><th className="num">Cycles</th><th className="num">Landings</th>
          <th className="num">APU h / cyc</th><th>Log ref</th><th>Reason</th><th>Entered by</th><th>Device time</th></tr></thead>
        <tbody>
          {[...versions].reverse().map((v, i) => (
            <tr key={v.id} className={v.is_void ? 'fr-void' : ''}>
              <td className="mono">{v.version}{i === 0 ? <span className="chip tone-blue fr-chip">Counts</span> : <span className="chip tone-grey fr-chip">Kept</span>}</td>
              <td className="mono">{formatPlainDate(v.flight_date, display)}</td>
              <td className="mono num">{formatHours(v.hours)}</td>
              <td className="mono num">{formatCount(v.cycles)}</td>
              <td className="mono num">{formatCount(v.landings)}</td>
              <td className="mono num">{formatHours(v.apu_hours)} / {formatCount(v.apu_cycles)}</td>
              <td className="mono small">{v.log_ref ?? '—'}</td>
              <td>{v.is_void && <span className="chip tone-grey">Entered in error</span>} {v.reason ?? (v.version === 1 ? 'Original entry' : '—')}</td>
              <td><span className="mono">{who(v)}</span> · <span className="mono small">{formatDateTime(v.entered_at, display)}</span></td>
              <td className="mono small">{v.device_time ? formatDateTime(v.device_time, display) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------- the forms ---
type Figures = { date: string; from: string; to: string; hours: string; cycles: string; landings: string;
  apuHours: string; apuCycles: string; logRef: string };

// Reads the typed figures; returns an error sentence or the numbers.
function readFigures(f: Figures, kind: 'flight' | 'baseline', allowZero = false) {
  const hours = Number(f.hours.replace(',', '.'));
  const cycles = Number(f.cycles);
  const landings = Number(f.landings);
  const apuHours = f.apuHours.trim() === '' ? null : Number(f.apuHours.replace(',', '.'));
  const apuCycles = f.apuCycles.trim() === '' ? null : Number(f.apuCycles);
  if (!f.date) return { error: 'Enter the date.' };
  if (f.hours.trim() === '' || !Number.isFinite(hours) || hours < 0) return { error: 'Enter the hours as a number, e.g. 2.4' };
  if (Math.abs(Math.round(hours * 10) - hours * 10) > 1e-6) return { error: 'Hours have one decimal place, e.g. 2.4' };
  if (!Number.isInteger(cycles) || cycles < 0 || f.cycles.trim() === '') return { error: 'Cycles are a whole number (0 or more).' };
  if (!Number.isInteger(landings) || landings < 0 || f.landings.trim() === '') return { error: 'Landings are a whole number (0 or more).' };
  if (apuHours !== null && (!Number.isFinite(apuHours) || apuHours < 0)) return { error: 'APU hours must be a number, or left empty.' };
  if (apuCycles !== null && (!Number.isInteger(apuCycles) || apuCycles < 0)) return { error: 'APU cycles must be a whole number, or left empty.' };
  if (kind === 'flight' && hours > 24) return { error: 'One flight entry cannot be more than 24 hours.' };
  if (kind === 'flight' && !allowZero && hours === 0 && cycles === 0 && landings === 0) return { error: 'Enter the hours, cycles or landings flown.' };
  return { hours, cycles, landings, apuHours, apuCycles };
}

function FigureFields({ f, set, basis, withRoute = true, dateLabel = 'Date' }: {
  f: Figures; set: (k: keyof Figures) => (v: string) => void; basis?: string; withRoute?: boolean; dateLabel?: string;
}) {
  const input = (k: keyof Figures, label: string, mode: 'decimal' | 'numeric' | 'text', hint?: string) => (
    <div>
      <label htmlFor={`fr-${k}`}>{label}{hint && <span className="hint"> {hint}</span>}</label>
      <input id={`fr-${k}`} className="mono" inputMode={mode === 'text' ? undefined : mode} value={f[k]}
        onChange={(e) => set(k)(e.target.value)} autoComplete="off" />
    </div>
  );
  return (
    <>
      <label htmlFor="fr-date">{dateLabel}</label>
      <DateField id="fr-date" value={f.date} onChange={set('date')} />
      {withRoute && (
        <div className="field-grid two fr-grid">
          {input('from', 'From', 'text', '(optional)')}
          {input('to', 'To', 'text', '(optional)')}
        </div>
      )}
      <div className="field-grid fr-grid">
        {input('hours', basisLabel(basis), 'decimal', '(e.g. 2.4)')}
        {input('cycles', 'Cycles', 'numeric')}
        {input('landings', 'Landings', 'numeric')}
      </div>
      <div className="field-grid two fr-grid">
        {input('apuHours', 'APU hours', 'decimal', '(optional)')}
        {input('apuCycles', 'APU cycles', 'numeric', '(optional)')}
      </div>
      {input('logRef', withRoute ? 'Flight / tech log reference' : 'Source reference', 'text', '(e.g. TLB 12/045)')}
    </>
  );
}

// Log flight hours (WF-H1). Big, plain fields so a pilot can do it on a phone.
function LogFlightForm({ aircraft, aircraftId, basis, baselineAsAt, onDone, onCancel }: {
  aircraft: AircraftOption[]; aircraftId: string; basis?: string; baselineAsAt: string | null;
  onDone: (message: string) => void; onCancel: () => void;
}) {
  const { me, display } = useAuth();
  const [params] = useSearchParams();
  const fixed = Boolean(params.get('aircraft'));
  const [tailId, setTailId] = useState(aircraftId);
  const blank = (): Figures => ({ date: todayIn(display.timeZone), from: '', to: '', hours: '', cycles: '1', landings: '1', apuHours: '', apuCycles: '', logRef: '' });
  const [f, setF] = useState<Figures>(blank);
  const [clientRef, setClientRef] = useState(newRef);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Figures) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const chosen = aircraft.find((a) => a.id === tailId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!tailId) return setError('Choose the aircraft.');
    const n = readFigures(f, 'flight');
    if ('error' in n) return setError(n.error!);
    if (f.date > todayIn(display.timeZone)) return setError('The date is in the future. Flight records are entered after flying.');
    if (baselineAsAt && tailId === aircraftId && f.date <= baselineAsAt) {
      return setError(`The brought-forward totals are as at ${formatPlainDate(baselineAsAt, display)}; flights on or before that date are already in them.`);
    }
    setBusy(true);
    const label = `Flight on ${chosen?.tail ?? 'tail'} ${formatPlainDate(f.date, display)}: ${formatHours(n.hours)} h, ${n.cycles} cyc, ${n.landings} ldg`;
    const r = await perform('log_flight', {
      p_aircraft: tailId, p_flight_date: f.date,
      p_hours: n.hours, p_cycles: n.cycles, p_landings: n.landings,
      p_from: f.from.trim() || undefined, p_to: f.to.trim() || undefined, p_log_ref: f.logRef.trim() || undefined,
      p_apu_hours: n.apuHours ?? undefined, p_apu_cycles: n.apuCycles ?? undefined,
      p_client_ref: clientRef, p_device_time: new Date().toISOString(),
    }, { label, aircraftId: tailId, recordPath: `/flights?aircraft=${tailId}` });
    setBusy(false);
    if (r.error) return setError(errorText(r.error));
    setClientRef(newRef());
    setF(blank());
    onDone(r.queued ? queuedText(r, label) : `${label} · saved. The totals now include it.`);
  }

  return (
    <form className="disp-form fr-form" onSubmit={submit}>
      <Section title="Aircraft and entered by">
        {fixed && chosen ? (
          <div><span className="mono">{chosen.tail}</span> · {chosen.type} <span className="small muted">(fixed from the tail you opened)</span></div>
        ) : (
          <>
            <label htmlFor="fr-aircraft" className="visually-hidden">Aircraft</label>
            <AircraftPicker id="fr-aircraft" aircraft={aircraft} value={tailId} onChange={setTailId} />
          </>
        )}
        <div className="small muted">Entered by {me?.fullName} · <span className="mono">{me?.tlc}</span> · with the device time and the server time (D-024)</div>
      </Section>
      <Section title="The flight" tone="strong">
        <FigureFields f={f} set={set} basis={basis} />
      </Section>
      {error && <div className="error" role="alert" style={{ margin: 0 }}>{error}</div>}
      <div className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
        <Link className="small" to="/sync">Offline? See send queue</Link>
      </div>
    </form>
  );
}

// Correct flight record (WF-FR1): Engineering, new version, reason, PIN.
function CorrectForm({ current, original, onDone, onCancel }: {
  current: FlightRecord; original: FlightRecord; onDone: (message: string, newId: string) => void; onCancel: () => void;
}) {
  const { display } = useAuth();
  const [f, setF] = useState<Figures>({
    date: current.flight_date, from: current.from_place ?? '', to: current.to_place ?? '',
    hours: String(current.hours), cycles: String(current.cycles), landings: String(current.landings),
    apuHours: current.apu_hours == null ? '' : String(current.apu_hours),
    apuCycles: current.apu_cycles == null ? '' : String(current.apu_cycles), logRef: current.log_ref ?? '',
  });
  const [reason, setReason] = useState('');
  const [voided, setVoided] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Figures) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const isBase = current.kind === 'baseline';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const n = voided ? { hours: 0, cycles: 0, landings: 0, apuHours: null, apuCycles: null } : readFigures(f, current.kind);
    if ('error' in n) return setError(n.error!);
    if (!reason.trim()) return setError('Give the reason for the correction (D-027).');
    if (!pin) return setError('Sign with your PIN.');
    setBusy(true);
    const { data, error: err } = await anyActions.rpc('correct_flight_record', {
      p_record: current.id, p_flight_date: f.date,
      p_hours: n.hours, p_cycles: n.cycles, p_landings: n.landings,
      p_reason: reason.trim(), p_pin: pin,
      p_from: f.from.trim() || null, p_to: f.to.trim() || null, p_log_ref: f.logRef.trim() || null,
      p_apu_hours: n.apuHours, p_apu_cycles: n.apuCycles,
      p_void: voided, p_device_time: new Date().toISOString(),
    });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    onDone(voided ? 'Marked as entered in error (new version). It no longer counts in the totals.'
      : `Corrected: version ${current.version + 1} saved. The original is kept in the version history.`, data as string);
  }

  const summary = (r: FlightRecord) =>
    `${formatHours(r.hours)} h · ${formatCount(r.cycles)} cycle${r.cycles === 1 ? '' : 's'} · ${formatCount(r.landings)} landing${r.landings === 1 ? '' : 's'}`
    + (r.apu_hours != null || r.apu_cycles != null ? ` · APU ${formatHours(r.apu_hours)} h, ${formatCount(r.apu_cycles)} cycles` : '');

  return (
    <form className="disp-form fr-form" onSubmit={submit}>
      <Section title="Original (kept)">
        <div className="mono">{summary(original)}</div>
        <div className="small muted">Logged by <span className="mono">{who(original)}</span> · {formatDateTime(original.entered_at, display)}
          {current.id !== original.id && <> · now at version {current.version}: <span className="mono">{summary(current)}</span></>}</div>
      </Section>
      <Section title={isBase ? 'Corrected brought-forward totals' : 'Corrected figures'} tone="strong">
        {!isBase && (
          <label className="check">
            <input type="checkbox" checked={voided} onChange={(e) => setVoided(e.target.checked)} />
            <span>Entered in error (e.g. wrong tail): it stays in history but counts for nothing</span>
          </label>
        )}
        {!voided && <FigureFields f={f} set={set} basis={current.hours_basis} withRoute={!isBase}
          dateLabel={isBase ? 'As at (date of the paper figures)' : 'Date'} />}
        <label htmlFor="fr-reason">Reason for correction</label>
        <textarea id="fr-reason" value={reason} onChange={(e) => setReason(e.target.value)} required
          placeholder="e.g. Tech log page reads 2.6 h" />
        <PinField value={pin} onChange={setPin} id="fr-pin" />
      </Section>
      {error && <div className="error" role="alert" style={{ margin: 0 }}>{error}</div>}
      <div className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save new version'}</button>
        <a className="button outline-button" href="#versions">Version history</a>
        <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Corrections need a connection: the PIN is checked by the server (D-104).</p>
    </form>
  );
}

// Brought-forward totals: once per tail, Engineering, reason and PIN.
function BaselineForm({ aircraftId, firstFlight, onDone, onCancel }: {
  aircraftId: string; firstFlight: string | null; onDone: (message: string) => void; onCancel: () => void;
}) {
  const { display } = useAuth();
  const { totals } = useAircraftTotals(aircraftId);
  const [f, setF] = useState<Figures>({ date: '', from: '', to: '', hours: '', cycles: '', landings: '', apuHours: '', apuCycles: '', logRef: '' });
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Figures) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const n = readFigures(f, 'baseline');
    if ('error' in n) return setError(n.error!);
    if (firstFlight && f.date >= firstFlight) {
      return setError(`The first logged flight is on ${formatPlainDate(firstFlight, display)}. The "as at" date must be before it.`);
    }
    if (!reason.trim()) return setError('Give the source of the figures (D-027).');
    if (!pin) return setError('Sign with your PIN.');
    setBusy(true);
    const { error: err } = await anyActions.rpc('set_flight_baseline', {
      p_aircraft: aircraftId, p_as_at: f.date, p_hours: n.hours, p_cycles: n.cycles, p_landings: n.landings,
      p_reason: reason.trim(), p_pin: pin, p_apu_hours: n.apuHours, p_apu_cycles: n.apuCycles,
      p_log_ref: f.logRef.trim() || null, p_device_time: new Date().toISOString(),
    });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    onDone('Brought-forward totals saved. The totals now start from these figures.');
  }

  return (
    <form className="disp-form fr-form" onSubmit={submit}>
      <Section title="Figures from the paper records" tone="strong">
        <p className="small muted" style={{ margin: 0 }}>
          Enter the totals exactly as the aircraft logbook shows them on the "as at" date. Flights after that date are logged
          one by one. {firstFlight && <>The first logged flight is on {formatPlainDate(firstFlight, display)}.</>}
        </p>
        <FigureFields f={f} set={set} basis={totals?.hours_basis} withRoute={false} dateLabel="As at (date of the paper figures)" />
        <label htmlFor="fr-reason">Reason and source</label>
        <textarea id="fr-reason" value={reason} onChange={(e) => setReason(e.target.value)} required
          placeholder="e.g. Brought forward from aircraft logbook vol. 3 at go-live" />
        <PinField value={pin} onChange={setPin} id="fr-pin" />
      </Section>
      {error && <div className="error" role="alert" style={{ margin: 0 }}>{error}</div>}
      <div className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save brought-forward totals'}</button>
        <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
