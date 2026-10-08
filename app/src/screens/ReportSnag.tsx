// Report a snag (D-040, D-041, D-213).
// Pilots and engineers report; the server gives the number (SNAG-000001) and
// records the time. The tail then shows blue "Snag open" until an engineer
// attends it (D-200). Reporting never changes the tail status (D-045).
//
// Opened from a tail, the tail is already filled in (D-098).
// Each form carries a one-off reference (client_ref). If the same report is
// sent twice (a double tap, or a re-send after the signal drops) the server
// recognises it and does not create a second snag.
import { useState, type FormEvent } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { db, errorText } from '../lib/supabase';
import { perform, queuedText } from '../lib/perform';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';

// crypto.randomUUID only works on https or localhost; a phone testing over
// plain http on the Wi-Fi needs the fallback.
function newRef(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const empty = { description: '', ata: '', book: '', page: '', item: '', soft: false };

export function ReportSnag() {
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [params] = useSearchParams();
  const [aircraftId, setAircraftId] = useState(params.get('aircraft') ?? '');
  const [form, setForm] = useState(empty);
  const [clientRef, setClientRef] = useState(newRef);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; number: string; tail: string; aircraftId: string; queued?: string } | null>(null);

  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const tail = aircraft.find((a) => a.id === aircraftId)?.tail ?? '';
  const fromTail = Boolean(params.get('aircraft'));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!aircraftId) return setError('Choose the aircraft.');
    if (!form.description.trim()) return setError('Describe the defect.');
    setBusy(true);
    // Offline, the report waits on the tablet; its one-off reference stops a
    // re-send creating a second snag (D-103).
    const { data: id, error: err, queued } = await perform('report_snag', {
      p_aircraft: aircraftId,
      p_description: form.description.trim(),
      p_soft_observation: form.soft,
      p_ata: form.ata.trim() || undefined,
      p_tlb_book: form.book.trim() || undefined,
      p_tlb_page: form.page.trim() || undefined,
      p_tlb_item: form.item.trim() || undefined,
      p_client_ref: clientRef,
      p_device_time: new Date().toISOString(),
    }, { label: `Report snag on ${tail}: ${form.description.trim().slice(0, 60)}`, aircraftId });
    if (queued) {
      setBusy(false);
      return setDone({ id: '', number: '', tail, aircraftId, queued: queuedText({ queued }, `Snag on ${tail}`) });
    }
    if (err) {
      setBusy(false);
      return setError(errorText(err));
    }
    const { data: snag } = await db.from('snag').select('number').eq('id', id as string).maybeSingle();
    setBusy(false);
    setDone({ id: id as string, number: snag?.number ?? 'Snag', tail, aircraftId });
  }

  function another() {
    setForm(empty);
    setClientRef(newRef());
    setDone(null);
  }

  if (done) {
    return (
      <div className="page">
        <div className="card narrow">
          {done.queued ? (
            <div className="offline-banner" role="status">{done.queued} The snag number is given by the server when it arrives.</div>
          ) : (
            <div className="success" role="status">
              <Link className="mono" to={`/snags/${done.id}`}>{done.number}</Link> reported on <span className="mono">{done.tail}</span>.
            </div>
          )}
          {!done.queued && <p>The tail now shows <strong>Snag open</strong> until an engineer attends it. Its status is unchanged.</p>}
          <p className="row">
            <Link className="button" to={`/aircraft/${done.aircraftId}`}>Back to {done.tail}</Link>
            <button type="button" onClick={another}>Report another</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/">All aircraft</Link>
        {fromTail && tail && <> › <Link className="mono" to={`/aircraft/${aircraftId}`}>{tail}</Link></>}
        {' '}› Report snag
      </div>
      <form className="card narrow" style={{ maxWidth: 640 }} onSubmit={submit}>
        <h1>Report snag{fromTail && tail ? <> on <span className="mono">{tail}</span></> : ''}</h1>

        {!fromTail && (
          <>
            <label htmlFor="aircraft">Aircraft</label>
            <AircraftPicker id="aircraft" aircraft={aircraft} value={aircraftId} onChange={setAircraftId} />
          </>
        )}

        <label htmlFor="description">Defect description</label>
        <textarea id="description" value={form.description} onChange={set('description')} required />

        <label className="check">
          <input type="checkbox" checked={form.soft} onChange={(e) => setForm((f) => ({ ...f, soft: e.target.checked }))} />
          Soft observation: not a defect, but please check (D-041)
        </label>

        <label htmlFor="ata">ATA <span className="hint">(optional, e.g. 21-31)</span></label>
        <input id="ata" className="mono" value={form.ata} onChange={set('ata')} />

        <div className="row">
          <div>
            <label htmlFor="book">Tech log book</label>
            <input id="book" className="mono" value={form.book} onChange={set('book')} />
          </div>
          <div>
            <label htmlFor="page">Page</label>
            <input id="page" className="mono" value={form.page} onChange={set('page')} />
          </div>
          <div>
            <label htmlFor="item">Item</label>
            <input id="item" className="mono" value={form.item} onChange={set('item')} />
          </div>
        </div>

        {error && <div className="error" role="alert">{error}</div>}
        <p>
          <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Report snag'}</button>
        </p>
      </form>
    </div>
  );
}
