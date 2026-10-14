// ADs and SBs compliance register (D-016, D-021, D-023, D-028), laid out as
// the Claude Design wireframe WF-S1 and the ADs / SBs panel in Home.dc.html.
//
// What it is: an engineer records, for each aircraft, whether each AD or SB
// applies, how it was complied with, when it was last complied with and the
// NEXT DUE AS THE ENGINEER WORKED IT OUT. Quality verifies each entry with
// their PIN (countersign) or rejects it with a reason. Corrections are new
// versions; the old one stays in history. Nexus never decides applicability
// and never calculates a due figure (D-020, D-021). It only flags an entered
// due: amber "Approaching" inside the operator's margin, red "Reached" at the
// entered figure (D-028). Hours / cycles are flagged only once flight-record
// totals exist; until then the figure is shown as entered.
//
// One address, /ads-sbs, chosen by the web address (like /ddls):
//   (nothing)                              every tail in scope
//   ?aircraft=<id>                         one tail's list (WF-S1)
//       &status=open|recurring|complied|not_applicable|awaiting|rejected|flagged
//       &type=AD|SB                        filters (any page with a list)
//   ?aircraft=<id>&do=new[&document=<key>] record an entry (engineer)
//   ?aircraft=<id>&entry=<key>             one entry: facts, Quality, history
//   ?aircraft=<id>&entry=<key>&do=correct  correct it (new version, reason, PIN)
//   ?view=register                         the AD / SB register
//   ?view=register&do=register             register an AD or SB (engineer)
//   ?view=register&document=<key>          one document, its versions and tails
//   ?view=register&document=<key>&do=correct  correct the record / new revision
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { anyDb } from '../lib/supabase';
import { formatDate, formatDateTime, formatPlainDate } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { Crumbs, BackButton, PageHead, Section, type Crumb } from '../components/PageFrame';
import { Fact, Message, TailTop } from './Ddls';
import {
  STATUS_LABEL, figures, useAdSbDocuments, useAdSbEntries,
  type AdSbDocument, type AdSbEntry, type AdSbVersion, type Status,
} from './adsb/data';
import { AdSbStatusChip, FlagChip, LastComplied, NextDue, VerifyCell, VerifyChip } from './adsb/parts';
import { DocumentForm, EntryForm, QualityForm } from './adsb/forms';
import '../styles/p2-adsb.css';

// For the aircraft page (wired by the lead): useAdSbSummary from
// './adsb/data' and <AdSbPanelBody /> from './adsb/parts'.

const STATUS_FILTERS: Record<string, string> = {
  '': 'All entries', open: 'Open', recurring: 'Recurring', complied: 'Complied', not_applicable: 'Not applicable',
  awaiting: 'Awaiting verification', rejected: 'Rejected by Quality', flagged: 'Approaching or reached',
};

function matches(r: AdSbEntry, status: string, type: string): boolean {
  if (type && r.doc_type !== type) return false;
  if (!status) return true;
  if (status === 'awaiting' || status === 'rejected') return r.verification_state === status;
  if (status === 'flagged') return Boolean(r.due_flag);
  return r.status === status;
}

// Flagged first (Reached, then Approaching), then by reference.
const rank = (r: AdSbEntry) => (r.due_flag === 'reached' ? 0 : r.due_flag === 'approaching' ? 1 : 2);
const byUrgency = (a: AdSbEntry, b: AdSbEntry) =>
  rank(a) - rank(b) || a.doc_type.localeCompare(b.doc_type) || a.reference.localeCompare(b.reference);

export function AdsSbs() {
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [params] = useSearchParams();
  const aircraftId = params.get('aircraft') ?? '';
  const entryKey = params.get('entry');
  const doing = params.get('do');
  if (params.get('view') === 'register') return <Register />;
  if (aircraftId && entryKey) return <EntryPage aircraftId={aircraftId} entryKey={entryKey} correcting={doing === 'correct'} aircraft={aircraft} />;
  if (aircraftId && doing === 'new') return <NewEntryPage aircraftId={aircraftId} aircraft={aircraft} />;
  return <ListPage aircraftId={aircraftId} aircraft={aircraft} />;
}

function useRole() {
  const { me } = useAuth();
  return {
    isEngineer: Boolean(me?.departments.some((d) => d.code === 'ENG')),
    isQuality: Boolean(me?.departments.some((d) => d.code === 'QUA')),
    personId: me?.personId ?? '',
  };
}

// ---------------------------------------------------------------- the lists
function ListPage({ aircraftId, aircraft }: { aircraftId: string; aircraft: AircraftOption[] }) {
  const { display } = useAuth();
  const { isEngineer } = useRole();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const type = params.get('type') ?? '';
  const tail = aircraft.find((a) => a.id === aircraftId);
  const { rows, error } = useAdSbEntries(aircraftId || undefined);
  const { docs } = useAdSbDocuments(aircraftId ? tail?.type ?? '__none__' : undefined);
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };
  const shown = (rows ?? []).filter((r) => matches(r, status, type)).sort(byUrgency);
  const awaiting = (rows ?? []).filter((r) => r.verification_state === 'awaiting').length;
  const rejected = (rows ?? []).filter((r) => r.verification_state === 'rejected').length;
  const flagged = (rows ?? []).filter((r) => r.due_flag).length;
  // ADs / SBs for this type with no entry on this tail yet (the engineer decides applicability).
  const entered = new Set((rows ?? []).map((r) => r.document_key));
  const notAssessed = aircraftId ? (docs ?? []).filter((d) => !entered.has(d.document_key) && (!type || d.doc_type === type)) : [];
  const base = aircraftId ? `/ads-sbs?aircraft=${aircraftId}` : '/ads-sbs?';
  const entryLink = (r: AdSbEntry) => `/ads-sbs?aircraft=${r.aircraft_id}&entry=${r.entry_key}`;

  return (
    <div className="page dd-page adsb-page">
      {aircraftId
        ? <TailTop aircraftId={aircraftId} tail={tail?.tail} here={[{ label: 'ADs and SBs' }]}
            back={{ to: `/aircraft/${aircraftId}`, label: `${tail?.tail ?? 'aircraft'} overview` }} />
        : <>
            <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'ADs and SBs' }]} />
            <BackButton to="/" label="All aircraft" />
          </>}
      <PageHead
        title={aircraftId ? <>ADs and SBs · <span className="mono">{tail?.tail}</span></> : 'ADs and SBs · all tails'}
        sub="Entered by engineers · verified by Quality · next due as entered, never calculated">
        <select aria-label="Status" value={status} onChange={(e) => set('status', e.target.value)}>
          {Object.entries(STATUS_FILTERS).map(([k, v]) => <option key={k} value={k}>Show: {v}</option>)}
        </select>
        <select aria-label="AD or SB" value={type} onChange={(e) => set('type', e.target.value)}>
          <option value="">ADs and SBs</option><option value="AD">ADs only</option><option value="SB">SBs only</option>
        </select>
        <AircraftPicker aircraft={aircraft} value={aircraftId}
          onChange={(id) => navigate(id ? `/ads-sbs?aircraft=${id}` : '/ads-sbs')} placeholder="All tails" />
        <Link className="button outline-button" to="/ads-sbs?view=register">Register</Link>
        {isEngineer && aircraftId && <Link className="button" to={`${base}&do=new`}>Record an AD or SB entry</Link>}
      </PageHead>

      {rows && (
        <div className="adsb-counts" role="group" aria-label="Summary">
          <button type="button" className={`adsb-count${status === 'awaiting' ? ' on' : ''}`} onClick={() => set('status', status === 'awaiting' ? '' : 'awaiting')}>
            <span className="adsb-count-n">{awaiting}</span> awaiting Quality</button>
          <button type="button" className={`adsb-count${rejected ? ' warn' : ''}${status === 'rejected' ? ' on' : ''}`} onClick={() => set('status', status === 'rejected' ? '' : 'rejected')}>
            <span className="adsb-count-n">{rejected}</span> rejected, to correct</button>
          <button type="button" className={`adsb-count${flagged ? ' warn' : ''}${status === 'flagged' ? ' on' : ''}`} onClick={() => set('status', status === 'flagged' ? '' : 'flagged')}>
            <span className="adsb-count-n">{flagged}</span> approaching or reached</button>
          {aircraftId && <span className="adsb-count static"><span className="adsb-count-n">{notAssessed.length}</span> not yet entered</span>}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {!rows && <p className="muted">Loading…</p>}
      {rows && (
        <div className="box">
          <div className="table-scroll">
            <table className="ptable adsb-table">
              <thead>
                <tr>
                  <th>Reference</th>{!aircraftId && <th>Tail</th>}<th>Status</th><th>Compliance method</th>
                  <th>Last complied</th><th>Next due (entered)</th><th>Quality verification</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.entry_key} className={`click-row${r.due_flag === 'reached' ? ' adsb-reached' : ''}`} onClick={() => navigate(entryLink(r))}>
                    <td>
                      <Link className="mono strong-link" to={entryLink(r)} onClick={(e) => e.stopPropagation()}>{r.doc_type} {r.reference}</Link>
                      <div className="small">{r.title}</div>
                      {r.document_revised && <div className="small adsb-warn-text">Register now at Rev {r.current_revision}; review</div>}
                    </td>
                    {!aircraftId && <td className="mono">{r.tail}</td>}
                    <td><AdSbStatusChip status={r.status} />{r.version > 1 && <div className="small muted">version {r.version}</div>}</td>
                    <td>{r.status === 'not_applicable' ? <span className="small">{r.not_applicable_reason}</span> : r.compliance_method ?? '—'}</td>
                    <td><LastComplied r={r} /></td>
                    <td>
                      <NextDue r={r} />
                      <div className="small muted"><span className="mono">{r.entered_by_tlc}</span> · {formatDate(r.entered_at, display)}</div>
                    </td>
                    <td><VerifyCell r={r} /></td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={aircraftId ? 6 : 7} className="muted">
                    {rows.length === 0 ? `No AD or SB entries${tail ? ` on ${tail.tail}` : ''} yet.` : 'No entries match the filter.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aircraftId && notAssessed.length > 0 && (
        <Section title={`In the register for the ${tail?.type ?? 'type'}, not yet entered on ${tail?.tail ?? 'this tail'}`}>
          <p className="small muted adsb-tight">Nexus does not decide whether these apply. An engineer records applicability for each.</p>
          <ul className="adsb-plain-list">
            {notAssessed.map((d) => (
              <li key={d.document_key}>
                <span className="mono">{d.doc_type} {d.reference}</span>{d.revision && <span className="mono"> Rev {d.revision}</span>} · {d.title}
                {isEngineer && <> · <Link to={`${base}&do=new&document=${d.document_key}`}>Record entry</Link></>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <p className="small muted">
        <span className="chip tone-amber">Approaching</span> inside the operator's margin ·{' '}
        <span className="chip tone-red">Reached</span> at the entered figure · dates against today; hours and cycles against
        the aircraft totals from flight records, when they exist · no projections. Nexus never grounds an aircraft.
      </p>
    </div>
  );
}

// --------------------------------------------------------- record an entry
function NewEntryPage({ aircraftId, aircraft }: { aircraftId: string; aircraft: AircraftOption[] }) {
  const { isEngineer } = useRole();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tail = aircraft.find((a) => a.id === aircraftId);
  const { rows } = useAdSbEntries(aircraftId);
  const { docs } = useAdSbDocuments(tail?.type ?? '__none__');
  const entered = new Set((rows ?? []).map((r) => r.document_key));
  const open = (docs ?? []).filter((d) => !entered.has(d.document_key));
  const listTo = `/ads-sbs?aircraft=${aircraftId}`;
  return (
    <div className="page dd-page adsb-page">
      <TailTop aircraftId={aircraftId} tail={tail?.tail} full={false}
        here={[{ label: 'ADs and SBs', to: listTo }, { label: 'Record an entry' }]} back={{ to: listTo, label: 'ADs and SBs' }} />
      <PageHead title={<>Record an AD or SB entry · <span className="mono">{tail?.tail}</span></>}
        sub="Engineer entry, signed with your PIN · Quality verifies it next">
        <Link className="button outline-button" to="/ads-sbs?view=register&do=register">Register a new AD or SB</Link>
      </PageHead>
      {!isEngineer ? <p className="muted">Only engineers record AD and SB entries.</p>
        : !docs || !rows ? <p className="muted">Loading…</p>
        : (
          <Section title="Entry">
            <EntryForm aircraftId={aircraftId} tail={tail?.tail ?? ''} documents={open} documentKey={params.get('document')}
              onDone={(m, key) => navigate(key ? `${listTo}&entry=${key}&msg=${encodeURIComponent(m)}` : listTo)}
              onCancel={() => navigate(listTo)} />
          </Section>
        )}
    </div>
  );
}

// -------------------------------------------------------------- one entry
function EntryPage({ aircraftId, entryKey, correcting, aircraft }: {
  aircraftId: string; entryKey: string; correcting: boolean; aircraft: AircraftOption[];
}) {
  const { display } = useAuth();
  const { isEngineer, isQuality, personId } = useRole();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [entry, setEntry] = useState<AdSbEntry | null | undefined>(undefined);
  const [history, setHistory] = useState<AdSbVersion[]>([]);
  const [message, setMessage] = useState(params.get('msg') ?? '');
  const tail = aircraft.find((a) => a.id === aircraftId);
  const listTo = `/ads-sbs?aircraft=${aircraftId}`;
  const here = `${listTo}&entry=${entryKey}`;

  const load = useCallback(async () => {
    const [cur, hist] = await Promise.all([
      anyDb.from('adsb_compliance_current').select('*').eq('entry_key', entryKey).maybeSingle(),
      anyDb.from('adsb_compliance').select(`id, version, status, applicability, not_applicable_reason, compliance_method,
        last_complied_on, last_complied_hours, last_complied_cycles, next_due_on, next_due_hours, next_due_cycles,
        next_due_text, correction_reason, entered_at, enterer:entered_by (three_letter_code),
        document:document_id (revision),
        verification:adsb_verification (decision, note, decided_at, decider:decided_by (three_letter_code))`)
        .eq('entry_key', entryKey).order('version', { ascending: false }),
    ]);
    setEntry((cur.data ?? null) as AdSbEntry | null);
    setHistory((hist.data ?? []) as AdSbVersion[]);
  }, [entryKey]);
  useEffect(() => { load(); }, [load]);
  // The message came in the address after saving; drop it from the address.
  useEffect(() => {
    if (params.get('msg')) { const p = new URLSearchParams(params); p.delete('msg'); setParams(p, { replace: true }); }
  }, [params, setParams]);

  const done = (m: string) => { setMessage(m); navigate(here); load(); window.scrollTo(0, 0); };
  const name = entry ? `${entry.doc_type} ${entry.reference}` : 'Entry';
  const crumbs: Crumb[] = [{ label: 'ADs and SBs', to: listTo }];
  if (correcting) crumbs.push({ label: name, to: here });
  crumbs.push({ label: correcting ? 'Correct entry' : name });
  const ownEntry = entry?.entered_by === personId;

  return (
    <div className="page dd-page adsb-page">
      <TailTop aircraftId={aircraftId} tail={tail?.tail ?? entry?.tail} here={crumbs} full={false}
        back={correcting ? { to: here, label: name } : { to: listTo, label: 'ADs and SBs' }} />
      {entry === undefined ? <p className="muted">Loading…</p> : !entry ? <p>This entry is not on {tail?.tail ?? 'this tail'}, or is outside your access.</p> : (
        <>
          <PageHead
            title={<><span className="mono">{name}</span> · <span className="mono">{entry.tail}</span>{correcting && ' · correction'}</>}
            sub={entry.title}>
            {!correcting && isEngineer && <Link className="button outline-button" to={`${here}&do=correct`}>Correct entry</Link>}
            <Link className="button outline-button" to={`/ads-sbs?view=register&document=${entry.document_key}`}>Document</Link>
          </PageHead>
          <Message text={message} />
          {entry.verification_state === 'rejected' && (
            <div className="adsb-banner adsb-banner-red" role="status">
              <strong>Rejected by Quality</strong> (<span className="mono">{entry.verified_by_tlc}</span>, {formatDateTime(entry.verified_at, display)}): {entry.verification_note}
              {isEngineer && !correcting && <> · <Link to={`${here}&do=correct`}>Correct it</Link></>}
            </div>
          )}
          {entry.document_revised && (
            <div className="adsb-banner" role="status">
              The register now holds <span className="mono">Rev {entry.current_revision ?? '—'}</span>; this entry was made against{' '}
              <span className="mono">Rev {entry.assessed_revision ?? '—'}</span>. An engineer reviews it and corrects the entry if needed.
            </div>
          )}

          {correcting ? (
            isEngineer
              ? <Section title={`Correct version ${entry.version}`}>
                  <EntryForm aircraftId={aircraftId} tail={entry.tail} entry={entry} onDone={(m) => done(m)} onCancel={() => navigate(here)} />
                </Section>
              : <p className="muted">Only engineers correct AD and SB entries.</p>
          ) : (
            <>
              <Section title="Entry" actions={<><AdSbStatusChip status={entry.status} /><FlagChip flag={entry.due_flag} /></>}>
                <div className="dd-grid">
                  <Fact k="Document"><span className="mono">{name}</span>{entry.assessed_revision && <span className="mono"> Rev {entry.assessed_revision}</span>}</Fact>
                  <Fact k="Issuing authority">{entry.issuing_authority}</Fact>
                  <Fact k="Applicability">{entry.applicability === 'applicable' ? 'Applicable' : <>Not applicable · {entry.not_applicable_reason}</>}</Fact>
                  <Fact k="Status">{STATUS_LABEL[entry.status as Status]}</Fact>
                  <Fact k="Compliance method">{entry.compliance_method ?? '—'}</Fact>
                  <Fact k="Last complied"><LastComplied r={entry} /></Fact>
                  <Fact k="Next due (as entered)"><NextDue r={entry} showFlag={false} /></Fact>
                  <Fact k="Compliance reference"><span className="mono">{entry.compliance_reference ?? '—'}</span></Fact>
                  <Fact k="Entered by"><span className="mono">{entry.entered_by_tlc}</span> · {formatDateTime(entry.entered_at, display)} (signed with PIN)</Fact>
                  <Fact k="Version">{entry.version}{entry.correction_reason && <span className="small"> · {entry.correction_reason}</span>}</Fact>
                  {entry.remarks && <Fact k="Remarks">{entry.remarks}</Fact>}
                </div>
                {(entry.hours_flag || entry.cycles_flag || entry.totals_available) && (
                  <p className="small muted adsb-tight">
                    Aircraft totals now: <span className="mono">{figures(entry.current_hours, entry.current_cycles) || '—'}</span> (sum of entered flight records).
                  </p>
                )}
                {!entry.totals_available && (entry.next_due_hours !== null || entry.next_due_cycles !== null) && (entry.status === 'open' || entry.status === 'recurring') && (
                  <p className="small muted adsb-tight">Hours and cycles are shown as entered. They are flagged once flight-record totals exist for this tail.</p>
                )}
                {entry.next_due_on && <p className="small muted adsb-tight">Due date entered: {formatPlainDate(entry.next_due_on, display)}. Nexus never calculates it.</p>}
              </Section>

              <Section title="Quality verification" actions={<VerifyChip state={entry.verification_state} />}>
                {entry.verification_state === 'verified' && (
                  <p className="adsb-tight">Countersigned by <span className="mono">{entry.verified_by_tlc}</span> · {formatDateTime(entry.verified_at, display)} (PIN){entry.verification_note && <> · {entry.verification_note}</>}</p>
                )}
                {entry.verification_state === 'rejected' && <p className="adsb-tight">Waiting for an engineer to correct it. The correction comes back here for verification.</p>}
                {entry.verification_state === 'awaiting' && (
                  isQuality && !ownEntry ? <QualityForm entry={entry} onDone={done} />
                    : isQuality && ownEntry ? <p className="muted adsb-tight">You entered this record; another Quality person verifies it.</p>
                    : <p className="muted adsb-tight">Unverified: waiting for Quality to countersign.</p>
                )}
              </Section>

              <Section title="History">
                <div className="table-scroll">
                  <table className="ptable">
                    <thead><tr><th>Version</th><th>Status</th><th>Next due (entered)</th><th>Entered</th><th>Reason for change</th><th>Quality</th></tr></thead>
                    <tbody>
                      {history.map((h) => {
                        const v = Array.isArray(h.verification) ? h.verification[0] : h.verification;
                        return (
                          <tr key={h.id} className={h.version === entry.version ? '' : 'adsb-old'}>
                            <td className="mono">{h.version}{h.version === entry.version && <span className="small"> · in force</span>}</td>
                            <td><AdSbStatusChip status={h.status} />{h.document?.revision && <div className="small mono">Rev {h.document.revision}</div>}</td>
                            <td className="small">
                              {[h.next_due_on ? formatPlainDate(h.next_due_on, display) : '', figures(h.next_due_hours, h.next_due_cycles), h.next_due_text ?? ''].filter(Boolean).join(' · ') || '—'}
                            </td>
                            <td><span className="mono">{h.enterer?.three_letter_code}</span> · {formatDateTime(h.entered_at, display)}</td>
                            <td className="small">{h.correction_reason ?? (h.version === 1 ? 'First entry' : '—')}</td>
                            <td className="small">
                              {v ? <><VerifyChip state={v.decision as AdSbEntry['verification_state']} /> <span className="mono">{v.decider?.three_letter_code}</span> · {formatDate(v.decided_at, display)}{v.note && <div>{v.note}</div>}</>
                                : h.version === entry.version ? <VerifyChip state="awaiting" /> : <span className="muted">Replaced before a decision</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="small muted adsb-tight">Nothing is deleted or edited: a correction adds a version.</p>
              </Section>
            </>
          )}
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------- the register
function useAircraftTypes() {
  const [types, setTypes] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    anyDb.from('aircraft_type').select('code, name').order('code')
      .then(({ data }: { data: { code: string; name: string }[] | null }) => setTypes(data ?? []));
  }, []);
  return types;
}

function Register() {
  const { display } = useAuth();
  const { isEngineer } = useRole();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const docKey = params.get('document');
  const doing = params.get('do');
  const type = params.get('type') ?? '';
  const acType = params.get('actype') ?? '';
  const types = useAircraftTypes();
  const { docs, reload } = useAdSbDocuments();
  const { rows } = useAdSbEntries();
  const [versions, setVersions] = useState<AdSbDocument[]>([]);
  const [message, setMessage] = useState('');
  const regTo = '/ads-sbs?view=register';
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };
  const doc = docs?.find((d) => d.document_key === docKey) ?? null;
  const tails = useMemo(() => (rows ?? []).filter((r) => r.document_key === docKey), [rows, docKey]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => m.set(r.document_key, (m.get(r.document_key) ?? 0) + 1));
    return m;
  }, [rows]);

  useEffect(() => {
    if (!docKey) return;
    anyDb.from('adsb_document').select('*').eq('document_key', docKey).order('version', { ascending: false })
      .then(({ data }: { data: AdSbDocument[] | null }) => setVersions(data ?? []));
  }, [docKey, docs]);

  const done = (m: string, key?: string) => {
    setMessage(m);
    reload();
    navigate(key ? `${regTo}&document=${key}` : regTo);
    window.scrollTo(0, 0);
  };

  const crumbs: Crumb[] = [{ label: 'All aircraft', to: '/' }, { label: 'ADs and SBs', to: '/ads-sbs' }, { label: 'Register', to: regTo }];
  if (doing === 'register') crumbs.push({ label: 'Register an AD or SB' });
  else if (doc) {
    if (doing === 'correct') crumbs.push({ label: `${doc.doc_type} ${doc.reference}`, to: `${regTo}&document=${doc.document_key}` }, { label: 'Correct record' });
    else crumbs.push({ label: `${doc.doc_type} ${doc.reference}` });
  }

  // ----- register a new one
  if (doing === 'register') {
    return (
      <div className="page dd-page adsb-page">
        <Crumbs items={crumbs} />
        <BackButton to={regTo} label="Register" />
        <PageHead title="Register an AD or SB" sub="Typed in by an engineer from the operator's own copy · nothing imported" />
        {isEngineer
          ? <Section title="Document"><DocumentForm types={types} onDone={done} onCancel={() => navigate(regTo)} /></Section>
          : <p className="muted">Only engineers add to the register.</p>}
      </div>
    );
  }

  // ----- one document
  if (docKey) {
    return (
      <div className="page dd-page adsb-page">
        <Crumbs items={crumbs} />
        <BackButton to={doing === 'correct' ? `${regTo}&document=${docKey}` : regTo} label={doing === 'correct' ? 'Document' : 'Register'} />
        {!docs ? <p className="muted">Loading…</p> : !doc ? <p>This AD / SB is not in the register, or is outside your access.</p> : (
          <>
            <PageHead title={<><span className="mono">{doc.doc_type} {doc.reference}</span>{doc.revision && <span className="mono"> Rev {doc.revision}</span>}</>} sub={doc.title}>
              {isEngineer && doing !== 'correct' && <Link className="button outline-button" to={`${regTo}&document=${docKey}&do=correct`}>Correct record / new revision</Link>}
            </PageHead>
            <Message text={message} />
            {doing === 'correct' ? (
              isEngineer
                ? <Section title={`Correct version ${doc.version}`}><DocumentForm types={types} doc={doc} onDone={done} onCancel={() => navigate(`${regTo}&document=${docKey}`)} /></Section>
                : <p className="muted">Only engineers correct the register.</p>
            ) : (
              <>
                <Section title="Document">
                  <div className="dd-grid">
                    <Fact k="Type">{doc.doc_type === 'AD' ? 'Airworthiness Directive' : 'Service Bulletin'}</Fact>
                    <Fact k="Issuing authority">{doc.issuing_authority}</Fact>
                    <Fact k="Applies to">{doc.aircraft_type_code}{doc.applies_to_note && <span className="small"> · {doc.applies_to_note}</span>}</Fact>
                    <Fact k="Effective">{formatPlainDate(doc.effective_on, display) || '—'}</Fact>
                    <Fact k="Entered by"><span className="mono">{doc.entered_by_tlc}</span> · {formatDate(doc.created_at, display)}</Fact>
                    <Fact k="Version">{doc.version}{doc.correction_reason && <span className="small"> · {doc.correction_reason}</span>}</Fact>
                  </div>
                </Section>
                <Section title="Entries on aircraft">
                  <div className="table-scroll">
                    <table className="ptable">
                      <thead><tr><th>Tail</th><th>Status</th><th>Next due (entered)</th><th>Quality</th></tr></thead>
                      <tbody>
                        {tails.map((r) => (
                          <tr key={r.entry_key}>
                            <td><Link className="mono" to={`/ads-sbs?aircraft=${r.aircraft_id}&entry=${r.entry_key}`}>{r.tail}</Link>
                              {r.document_revised && <div className="small adsb-warn-text">made against Rev {r.assessed_revision ?? '—'}</div>}</td>
                            <td><AdSbStatusChip status={r.status} /></td>
                            <td><NextDue r={r} /></td>
                            <td><VerifyCell r={r} /></td>
                          </tr>
                        ))}
                        {tails.length === 0 && <tr><td colSpan={4} className="muted">No aircraft in your scope has an entry for this document yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Section>
                {versions.length > 1 && (
                  <Section title="Versions">
                    <div className="table-scroll">
                      <table className="ptable">
                        <thead><tr><th>Version</th><th>Reference</th><th>Revision</th><th>Title</th><th>Reason</th><th>When</th></tr></thead>
                        <tbody>
                          {versions.map((v) => (
                            <tr key={v.id} className={v.id === doc.id ? '' : 'adsb-old'}>
                              <td className="mono">{v.version}</td><td className="mono">{v.reference}</td><td className="mono">{v.revision ?? '—'}</td>
                              <td>{v.title}</td><td className="small">{v.correction_reason ?? 'First entry'}</td>
                              <td>{formatDateTime(v.created_at, display)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // ----- the whole register
  const shown = (docs ?? []).filter((d) => (!type || d.doc_type === type) && (!acType || d.aircraft_type_code === acType));
  return (
    <div className="page dd-page adsb-page">
      <Crumbs items={crumbs} />
      <BackButton to="/ads-sbs" label="ADs and SBs" />
      <PageHead title="AD and SB register" sub="Documents in force · each aircraft's compliance is a separate, verified entry">
        <select aria-label="AD or SB" value={type} onChange={(e) => set('type', e.target.value)}>
          <option value="">ADs and SBs</option><option value="AD">ADs only</option><option value="SB">SBs only</option>
        </select>
        <select aria-label="Aircraft type" value={acType} onChange={(e) => set('actype', e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}
        </select>
        {isEngineer && <Link className="button" to={`${regTo}&do=register`}>Register an AD or SB</Link>}
      </PageHead>
      <Message text={message} />
      {!docs ? <p className="muted">Loading…</p> : (
        <div className="box">
          <div className="table-scroll">
            <table className="ptable">
              <thead><tr><th>Reference</th><th>Title</th><th>Issued by</th><th>Applies to</th><th>Revision</th><th>Tails entered</th></tr></thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.document_key} className="click-row" onClick={() => navigate(`${regTo}&document=${d.document_key}`)}>
                    <td><Link className="mono strong-link" to={`${regTo}&document=${d.document_key}`} onClick={(e) => e.stopPropagation()}>{d.doc_type} {d.reference}</Link></td>
                    <td>{d.title}</td>
                    <td>{d.issuing_authority}</td>
                    <td className="mono">{d.aircraft_type_code}</td>
                    <td className="mono">{d.revision ?? '—'}</td>
                    <td className="mono">{counts.get(d.document_key) ?? 0}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} className="muted">Nothing in the register{type || acType ? ' matches the filter' : ' yet'}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
