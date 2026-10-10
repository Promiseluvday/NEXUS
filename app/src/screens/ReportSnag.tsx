// Report a snag (D-040, D-041, D-213), laid out as the Claude Design
// wireframe WF-D7.
// Pilots and engineers report; the server gives the number (SNAG-000001) and
// records the time. The tail then shows blue "Snag open" until an engineer
// attends it (D-200). Reporting never changes the tail status (D-045).
//
// Opened from a tail, the tail is already filled in (D-098).
// Each form carries a one-off reference (client_ref). If the same report is
// sent twice (a double tap, or a re-send after the signal drops) the server
// recognises it and does not create a second snag.
//
// Photos: a file needs the snag's record to hang on, so photos and scans are
// added on the next screen, once the snag has its number (D-026: PDF and
// images only).
import { useState, type FormEvent } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { db, errorText } from '../lib/supabase';
import { perform, queuedText } from '../lib/perform';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { Attachments } from '../components/Attachments';
import { BackButton, Crumbs, PageHead, Section, type Crumb } from '../components/PageFrame';

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
  const chosen = aircraft.find((a) => a.id === aircraftId);
  const tail = chosen?.tail ?? '';
  const fromTail = Boolean(params.get('aircraft'));
  const back = fromTail ? { to: `/aircraft/${aircraftId}`, label: tail || 'the aircraft' } : { to: '/', label: 'All aircraft' };
  const crumbs: Crumb[] = [
    { label: 'All aircraft', to: '/' },
    ...(fromTail && tail ? [{ label: <span className="mono">{tail}</span>, to: `/aircraft/${aircraftId}` }] : []),
    { label: 'Report snag' },
  ];

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

  // After sending: the number, what the tail now shows, and a place to add photos.
  if (done) {
    return (
      <div className="page snag-page">
        <Crumbs items={crumbs} />
        <BackButton to={back.to} label={back.label} />
        <PageHead title={done.queued ? 'Snag kept on this tablet' : <><span className="mono">{done.number}</span> reported</>} />
        {done.queued ? (
          <div className="offline-banner" role="status">
            {done.queued} The snag number is given by the server when it arrives. <Link to="/sync">Send queue</Link>
          </div>
        ) : (
          <div className="success" role="status" style={{ margin: 0 }}>
            <Link className="mono" to={`/snags/${done.id}`}>{done.number}</Link> reported on <span className="mono">{done.tail}</span>.
            The tail now shows <strong>Snag open</strong> until an engineer attends it. Its status is unchanged (D-045).
          </div>
        )}
        {!done.queued && (
          <Section title="Photo (PDF or image only)">
            <Attachments recordTable="snag" recordId={done.id} kinds={['photo', 'tech_log_page', 'document']} canUpload />
          </Section>
        )}
        <div className="action-row">
          {!done.queued && <Link className="button" to={`/snags/${done.id}`}>Open {done.number}</Link>}
          <Link className="button outline-button" to={`/aircraft/${done.aircraftId}`}>Back to {done.tail}</Link>
          <button type="button" className="outline-button" onClick={another}>Report another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page snag-page">
      <Crumbs items={crumbs} />
      <BackButton to={back.to} label={back.label} />
      <PageHead title={<>Report snag{tail && <> · <span className="mono">{tail}</span></>}</>}
        sub={'Pilot or engineer · a pilot report shows "Snag open" only; it never changes the tail status (D-045, D-200)'} />

      <form className="disp-form report-form" onSubmit={submit}>
        <Section title="Aircraft">
          {fromTail && chosen ? (
            <div><span className="mono">{chosen.tail}</span> · {chosen.type} <span className="small muted">(from the tail you opened)</span></div>
          ) : (
            <>
              <label htmlFor="aircraft" className="visually-hidden">Aircraft</label>
              <AircraftPicker id="aircraft" aircraft={aircraft} value={aircraftId} onChange={setAircraftId} />
            </>
          )}
        </Section>

        <Section title="Technical log reference (paper TLB)">
          <div className="field-grid">
            <div>
              <label htmlFor="book">TLB Book No</label>
              <input id="book" className="mono" value={form.book} onChange={set('book')} />
            </div>
            <div>
              <label htmlFor="page">TLB Page No</label>
              <input id="page" className="mono" value={form.page} onChange={set('page')} />
            </div>
            <div>
              <label htmlFor="item">TLB Item No</label>
              <input id="item" className="mono" value={form.item} onChange={set('item')} />
            </div>
          </div>
        </Section>

        <Section title="The defect" tone="strong">
          {/* Type: a defect, or a soft observation the pilot wants checked
              (D-041). Both are dispositioned by an engineer (D-042). */}
          <fieldset className="type-choice">
            <legend className="label">Type</legend>
            <label className="check">
              <input type="radio" name="snag-type" checked={!form.soft} onChange={() => setForm((f) => ({ ...f, soft: false }))} />
              <span>Defect</span>
            </label>
            <label className="check">
              <input type="radio" name="snag-type" checked={form.soft} onChange={() => setForm((f) => ({ ...f, soft: true }))} />
              <span>Observation: not a defect, but please check (D-041)</span>
            </label>
          </fieldset>
          <p className="small muted" style={{ margin: 0 }}>
            A cabin item with no airworthiness effect?{' '}
            <Link to={aircraftId ? `/cabin-item?aircraft=${aircraftId}` : '/cabin-item'}>Propose it as a NADD on the cabin map</Link> (D-209).
          </p>

          <label htmlFor="description">Description</label>
          <textarea id="description" value={form.description} onChange={set('description')} required />

          <label htmlFor="ata">ATA <span className="hint">(optional, e.g. 21-31)</span></label>
          <input id="ata" className="mono" value={form.ata} onChange={set('ata')} />
        </Section>

        <Section title="Photo (PDF or image only)">
          <p className="small muted" style={{ margin: 0 }}>
            Add photos or scans on the next screen, once the snag has its number.
          </p>
        </Section>

        {error && <div className="error" role="alert" style={{ margin: 0 }}>{error}</div>}
        <div className="action-row">
          <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit'}</button>
          <Link className="button outline-button" to={back.to}>Cancel</Link>
          <Link className="small" to="/sync">Offline? See send queue</Link>
        </div>
      </form>
    </div>
  );
}
