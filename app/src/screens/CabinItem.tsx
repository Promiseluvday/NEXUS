// Report a cabin item on a cabin map (D-209).
// Crew or engineers tap the zone, say where and what. It becomes a PROPOSED
// NADD; an engineer confirms it, rejects it with a reason, or raises it as a
// snag. Emergency equipment, exits, oxygen and emergency lighting are NEVER
// NADDs: tapping one sends you to Report snag instead.
// The zones come from the operator's set-up for each aircraft type.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { db, errorText } from '../lib/supabase';
import { perform, queuedText } from '../lib/perform';
import { cached } from '../lib/offline/cache';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';

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
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [params] = useSearchParams();
  const [aircraftId, setAircraftId] = useState(params.get('aircraft') ?? '');
  const [zones, setZones] = useState<Zone[]>([]);
  const [zone, setZone] = useState<Zone | null>(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [clientRef, setClientRef] = useState(newRef);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const type = aircraft.find((a) => a.id === aircraftId)?.type;
  const tail = aircraft.find((a) => a.id === aircraftId)?.tail;

  useEffect(() => {
    setZone(null);
    if (!type) return setZones([]);
    cached(`zones:${type}`, () => db.from('cabin_zone').select('code, name, is_emergency_equipment').eq('aircraft_type_code', type).order('code'))
      .then(({ data }) => setZones((data ?? []) as Zone[]));
  }, [type]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!zone) return setError('Tap the zone on the cabin map.');
    if (!description.trim()) return setError('Describe the item.');
    setBusy(true);
    const { data, error: err, queued } = await perform('propose_nadd', {
      p_aircraft: aircraftId, p_description: description.trim(), p_zone: zone.code,
      p_location: location.trim() || undefined, p_client_ref: clientRef, p_device_time: new Date().toISOString(),
    }, { label: `Cabin item on ${tail}: ${zone.name}, ${description.trim().slice(0, 50)}`, aircraftId });
    setBusy(false);
    if (queued) return setDone(queuedText({ queued }, `Cabin item on ${tail}`));
    if (err) return setError(errorText(err));
    const { data: n } = await db.from('nadd').select('number').eq('id', data as string).maybeSingle();
    setDone(`${n?.number ?? 'Cabin item'} reported on ${tail}. An engineer will confirm it as a NADD, reject it with a reason, or raise it as a snag.`);
  }

  if (done) {
    return (
      <div className="page">
        <div className="card narrow">
          <div className="success" role="status">{done}</div>
          <p className="row">
            <Link className="button" to={`/nadds?aircraft=${aircraftId}`}>See NADDs on {tail}</Link>
            <button type="button" onClick={() => { setDone(''); setDescription(''); setLocation(''); setZone(null); setClientRef(newRef()); }}>
              Report another
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">All aircraft</Link> › Report cabin item</div>
      <form className="card" style={{ maxWidth: 760 }} onSubmit={submit}>
        <h1>Report a cabin item</h1>
        <p className="small muted">For convenience items only. Anything that could affect safety or airworthiness is a snag.</p>
        <label htmlFor="cabin-aircraft">Aircraft</label>
        <AircraftPicker id="cabin-aircraft" aircraft={aircraft} value={aircraftId} onChange={setAircraftId} />

        {type && (
          <>
            <div className="label">Tap the zone</div>
            {zones.length === 0 && <p className="small muted">No cabin map is set up for the {type} yet. A Super Admin adds the zones.</p>}
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

        {zone && !zone.is_emergency_equipment && (
          <>
            <label htmlFor="cabin-location">Exact place <span className="hint">(e.g. seat 3A, left side)</span></label>
            <input id="cabin-location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <label htmlFor="cabin-description">What is wrong</label>
            <textarea id="cabin-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            {error && <div className="error" role="alert">{error}</div>}
            <p><button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Report cabin item'}</button></p>
          </>
        )}
        {error && !zone && <div className="error" role="alert">{error}</div>}
      </form>
    </div>
  );
}
