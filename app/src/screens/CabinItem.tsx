// Log a NADD / report a cabin item on the cabin map (D-160, D-209), laid out
// as the Claude Design wireframe WF-NA2.
//
// Crew or engineers tap the zone, say where and what, and give the paper TLB
// reference (D-164). It becomes a PROPOSED NADD; an engineer confirms it,
// rejects it with a reason, or raises it as a snag. An engineer may log and
// confirm in one go: the declaration "not covered by the MEL, no
// airworthiness effect" and their PIN (D-160). The countdown runs from the
// report date.
// Emergency equipment, exits, oxygen and emergency lighting are NEVER
// NADDs: tapping one sends you to Report snag instead.
// The zones come from the operator's set-up for each aircraft type.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { db, errorText } from '../lib/supabase';
import { perform, queuedText } from '../lib/perform';
import { cached } from '../lib/offline/cache';
import { formatDateTime } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { BackButton, Crumbs, PageHead, Section } from '../components/PageFrame';
import { PinField } from '../components/PinField';

type Zone = { code: string; name: string; is_emergency_equipment: boolean };

function newRef(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function CabinItem() {
  const { me, display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [params] = useSearchParams();
  const [aircraftId, setAircraftId] = useState(params.get('aircraft') ?? '');
  const [zones, setZones] = useState<Zone[]>([]);
  const [zone, setZone] = useState<Zone | null>(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [ata, setAta] = useState('');
  const [tlb, setTlb] = useState({ book: '', page: '', item: '' });
  const [limit, setLimit] = useState('');
  const [defaultLimit, setDefaultLimit] = useState(120);
  const [declared, setDeclared] = useState(false);
  const [pin, setPin] = useState('');
  const [clientRef, setClientRef] = useState(newRef);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ text: string; id?: string; problem?: boolean } | null>(null);
  const [reportedAt] = useState(() => new Date());
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));
  const type = aircraft.find((a) => a.id === aircraftId)?.type;
  const tail = aircraft.find((a) => a.id === aircraftId)?.tail;
  const listTo = aircraftId ? `/nadds?aircraft=${aircraftId}` : '/nadds';

  useEffect(() => {
    setZone(null);
    if (!type) return setZones([]);
    cached(`zones:${type}`, () => db.from('cabin_zone').select('code, name, is_emergency_equipment').eq('aircraft_type_code', type).order('code'))
      .then(({ data }) => setZones((data ?? []) as Zone[]));
  }, [type]);
  useEffect(() => {
    db.from('operator_setting_current').select('value').eq('key', 'nadd.default_limit_days').maybeSingle()
      .then(({ data }) => { if (data?.value) setDefaultLimit(Number(data.value)); });
  }, []);

  // confirmNow: an engineer logs and confirms in one go (two steps on the
  // server: propose, then confirm with PIN and declaration).
  async function submit(e: FormEvent | { preventDefault(): void }, confirmNow: boolean) {
    e.preventDefault();
    setError('');
    if (!aircraftId) return setError('Choose the aircraft.');
    if (zones.length > 0 && !zone) return setError('Tap the zone on the cabin map.');
    if (zone?.is_emergency_equipment) return setError('Emergency equipment is never a NADD. Report a snag instead (D-209).');
    if (!description.trim()) return setError('Describe the item.');
    if (confirmNow) {
      if (!declared) return setError('Tick the declaration: not covered by the MEL and no airworthiness effect (D-160).');
      if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN (4 to 8 digits) to sign.');
    }
    setBusy(true);
    const what = `${zone ? `${zone.name}, ` : ''}${description.trim().slice(0, 50)}`;
    const { data, error: err, queued } = await perform('propose_nadd', {
      p_aircraft: aircraftId, p_description: description.trim(), p_zone: zone?.code,
      p_location: location.trim() || undefined, p_ata: ata.trim() || undefined,
      p_tlb_book: tlb.book.trim() || undefined, p_tlb_page: tlb.page.trim() || undefined, p_tlb_item: tlb.item.trim() || undefined,
      p_client_ref: clientRef, p_device_time: new Date().toISOString(),
    }, { label: `NADD on ${tail}: ${what}`, aircraftId });
    if (queued) {
      setBusy(false);
      return setDone({ text: queuedText({ queued }, `NADD on ${tail}`) + (confirmNow ? ' Confirm it from the NADD list once it has been sent.' : '') });
    }
    if (err) { setBusy(false); return setError(errorText(err)); }
    const id = data as string;
    const { data: n } = await db.from('nadd').select('number').eq('id', id).maybeSingle();
    const number = n?.number ?? 'NADD';
    if (!confirmNow) {
      setBusy(false);
      return setDone({ id, text: `${number} proposed on ${tail}. An engineer will confirm it as a NADD, reject it with a reason, or raise it as a snag.` });
    }
    const c = await perform('confirm_nadd', { p_nadd: id, p_pin: pin, p_declaration: true, p_limit_days: limit ? Number(limit) : undefined },
      { label: `Confirm ${number} as NADD`, aircraftId });
    setBusy(false);
    if (c.error) {
      return setDone({ id, problem: true, text: `${number} was logged as proposed, but the confirmation was not recorded: ${errorText(c.error)} Confirm it from the NADD page.` });
    }
    setDone({ id, text: c.queued ? queuedText(c, `${number} logged; confirmation`) : `${number} logged and confirmed on ${tail}. Its countdown runs from the report date (D-160).` });
  }

  function reset() {
    setDone(null); setDescription(''); setLocation(''); setAta(''); setZone(null); setTlb({ book: '', page: '', item: '' });
    setLimit(''); setDeclared(false); setPin(''); setClientRef(newRef());
  }

  const top = (
    <>
      <Crumbs items={[
        { label: 'All aircraft', to: '/' },
        ...(aircraftId ? [{ label: <span className="mono">{tail}</span>, to: `/aircraft/${aircraftId}` }] : []),
        { label: 'NADD list', to: listTo }, { label: 'Log NADD' },
      ]} />
      <BackButton to={listTo} label="NADD list" />
    </>
  );

  if (done) {
    return (
      <div className="page dd-page">
        {top}
        <div className={done.problem ? 'error' : /provisional|queued/.test(done.text) ? 'offline-banner' : 'success'} role="status">{done.text}</div>
        <p className="action-row">
          {done.id && <Link className="button" to={`/nadds?aircraft=${aircraftId}&nadd=${done.id}`}>Open the NADD</Link>}
          <Link className="button outline-button" to={listTo}>See NADDs on {tail}</Link>
          <button type="button" className="outline-button" onClick={reset}>Log another</button>
        </p>
      </div>
    );
  }

  return (
    <div className="page dd-page">
      {top}
      <PageHead title={<>Log NADD{tail && <> · <span className="mono">{tail}</span></>}</>}
        sub={isEngineer ? 'Engineer: log and confirm in one step, or propose only' : 'Propose as NADD; an engineer confirms it'} />
      <form className="dd-form" onSubmit={(e) => submit(e, false)}>
        <Section title="Aircraft and place">
          <p className="small muted" style={{ margin: 0 }}>For convenience items only. Anything that could affect safety or airworthiness is a snag.</p>
          <div>
            <label htmlFor="cabin-aircraft" style={{ marginTop: 0 }}>Aircraft</label>
            <AircraftPicker id="cabin-aircraft" aircraft={aircraft} value={aircraftId} onChange={setAircraftId} />
          </div>
          {type && (
            <>
              <div className="label">Tap the zone on the cabin map</div>
              {zones.length === 0 && <p className="small muted">No cabin map is set up for the {type} yet. A Super Admin adds the zones. Describe the place below.</p>}
              <div className="cabin-map" role="group" aria-label={`Cabin map, ${type}`}>
                {zones.map((z) => (
                  <button key={z.code} type="button"
                    className={`zone${z.is_emergency_equipment ? ' emergency' : ''}${zone?.code === z.code ? ' chosen' : ''}`}
                    aria-pressed={zone?.code === z.code} onClick={() => setZone(z)}>
                    <span className="mono small">{z.code}</span>
                    <span>{z.name}</span>
                    {z.is_emergency_equipment && <span className="small">Emergency: snag only</span>}
                  </button>
                ))}
              </div>
            </>
          )}
          {zone?.is_emergency_equipment && (
            <div className="notice">
              <strong>{zone.name}</strong> is emergency equipment. It is never a NADD (D-209); it goes through the snag workflow.
              <p><Link className="button" to={`/report-snag?aircraft=${aircraftId}`}>Report a snag instead</Link></p>
            </div>
          )}
        </Section>

        {!zone?.is_emergency_equipment && (
          <>
            <Section title="Technical log reference (paper TLB)">
              <div className="row dd-form-row">
                <div><label htmlFor="n-book">TLB book no</label><input id="n-book" className="mono" placeholder="e.g. 14" value={tlb.book} onChange={(e) => setTlb({ ...tlb, book: e.target.value })} /></div>
                <div><label htmlFor="n-page">TLB page no</label><input id="n-page" className="mono" placeholder="e.g. 0372" value={tlb.page} onChange={(e) => setTlb({ ...tlb, page: e.target.value })} /></div>
                <div><label htmlFor="n-item">TLB item no</label><input id="n-item" className="mono" placeholder="e.g. 2" value={tlb.item} onChange={(e) => setTlb({ ...tlb, item: e.target.value })} /></div>
              </div>
            </Section>

            <Section title="The defect">
              <div className="row dd-form-row">
                <div><label htmlFor="cabin-location" style={{ marginTop: 0 }}>Exact place <span className="hint">(e.g. seat 12C, reading light)</span></label>
                  <input id="cabin-location" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
                <div className="dd-narrow"><label htmlFor="cabin-ata" style={{ marginTop: 0 }}>ATA chapter <span className="hint">(optional)</span></label>
                  <input id="cabin-ata" className="mono" value={ata} onChange={(e) => setAta(e.target.value)} /></div>
              </div>
              <div>
                <label htmlFor="cabin-description" style={{ marginTop: 0 }}>What is wrong</label>
                <textarea id="cabin-description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="small muted">Photo (PDF or image only) <span className="rail-tag">Soon</span></div>
              <div className="small">Reported <span className="mono">{formatDateTime(reportedAt, display)}</span> · the countdown starts on this date (D-160)</div>
            </Section>

            {isEngineer && (
              <Section title="Engineer confirmation (certifying engineer, PIN)">
                <div>
                  <label htmlFor="n-limit" style={{ marginTop: 0 }}>Limit in days <span className="hint">({defaultLimit} by default; shorter allowed; longer needs an extension)</span></label>
                  <input id="n-limit" className="mono dd-short" inputMode="numeric" placeholder={String(defaultLimit)} value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ''))} />
                </div>
                <label className="check"><input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
                  <span>Not covered by the MEL and no effect on airworthiness (D-160).</span></label>
                <PinField id="n-pin" value={pin} onChange={setPin} />
              </Section>
            )}

            {error && <div className="error" role="alert">{error}</div>}
            <p className="action-row">
              {isEngineer && (
                <button type="button" disabled={busy} onClick={(e) => submit(e, true)}>{busy ? 'Sending…' : 'Log and confirm NADD'}</button>
              )}
              <button type="submit" disabled={busy} className={isEngineer ? 'outline-button' : undefined}>
                {busy ? 'Sending…' : 'Propose as NADD'}
              </button>
              <Link className="button outline-button" to={listTo}>Cancel</Link>
            </p>
          </>
        )}
        {error && zone?.is_emergency_equipment && <div className="error" role="alert">{error}</div>}
      </form>
    </div>
  );
}
