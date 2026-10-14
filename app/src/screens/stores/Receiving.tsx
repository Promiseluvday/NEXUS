// Receiving inspection and part registration (WF-J2), Forward Store direct
// receipt (WF-FWD1) and Main Store acknowledgement (D-142, D-150).
//
//   1. Open a receipt: store, part (or register a new part), quantity,
//      serial or batch, shelf-life date, what it was delivered against.
//   2. Attach the release documents: certificate and serviceable tag, PDF or
//      image (D-026, D-153). Which are required per part class is Quality's
//      setting (D-148).
//   3. Accept to stock (PIN) with the certificate type from Quality's list, or
//      send to quarantine with a reason. Only Supply does this (D-074).
//   4. Received at the Forward Store: the Main Store acknowledges it before it
//      counts as stock (D-142, D-150).
// Receiving needs a connection: nothing here is queued offline (D-104).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, db, errorText } from '../../lib/supabase';
import { formatDateTime, formatPlainDate } from '../../lib/format';
import { fileProblem } from '../../components/Attachments';
import { PinField } from '../../components/PinField';
import { BackButton, Crumbs, PageHead, Section } from '../../components/PageFrame';
import { Empty, StoresTabs, qtyText, useMyStores, useSupplyRights } from './common';
import { useCertificateTypes } from './Supply';
import type { SearchRow } from './Search';

const DOC_LABEL: Record<string, string> = {
  release_certificate: 'Release certificate',
  serviceable_tag: 'Serviceable tag',
};

type Receipt = {
  id: string; number: string; store_code: string; qty: number; serial_no: string | null; batch_no: string | null;
  bin: string | null; shelf_life_expires_on: string | null; delivered_against: string | null; status: string;
  certificate_type: string | null; certificate_ref: string | null; quarantine_reason: string | null;
  created_at: string; inspected_at: string | null; acknowledged_at: string | null; lot_id: string | null;
  part_id: string; part: { part_number: string; description: string; part_class: string; serialised: boolean; shelf_life_tracked: boolean } | null;
  opener: { three_letter_code: string } | null; inspector: { three_letter_code: string } | null;
  acknowledger: { three_letter_code: string } | null;
};

const STATUS: Record<string, { label: string; tone: string }> = {
  inspecting:   { label: 'Receiving inspection', tone: 'amber' },
  awaiting_ack: { label: 'Received at Forward · Main to acknowledge', tone: 'blue' },
  accepted:     { label: 'Accepted to stock', tone: 'green' },
  quarantined:  { label: 'Quarantined', tone: 'red' },
};
export function ReceiptChip({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'grey' };
  return <span className={`chip tone-${s.tone}`}>{s.label}</span>;
}

const SELECT = `id, number, store_code, qty, serial_no, batch_no, bin, shelf_life_expires_on, delivered_against, status,
  certificate_type, certificate_ref, quarantine_reason, created_at, inspected_at, acknowledged_at, lot_id, part_id,
  part:part_id (part_number, description, part_class, serialised, shelf_life_tracked),
  opener:opened_by (three_letter_code), inspector:inspected_by (three_letter_code),
  acknowledger:acknowledged_by (three_letter_code)`;

// ------------------------------------------------------- list + new receipt
export function Receiving() {
  const { display } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { stores, held } = useMyStores();
  const { canReceive } = useSupplyRights();
  const record = stores.find((s) => s.is_store_of_record)?.code;
  const [rows, setRows] = useState<Receipt[] | null>(null);
  const [transfers, setTransfers] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // New receipt form
  const [store, setStore] = useState(params.get('store') ?? '');
  const [partText, setPartText] = useState('');
  const [matches, setMatches] = useState<SearchRow[]>([]);
  const [part, setPart] = useState<SearchRow | null>(null);
  const [register, setRegister] = useState(false);
  const [np, setNp] = useState({ pn: '', desc: '', cls: 'component', unit: 'EA', shelf: false, serial: false });
  const [f, setF] = useState({ qty: '1', serial: '', batch: '', expiry: '', bin: '', against: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!store && held.length) setStore(held.includes(params.get('store') ?? '') ? params.get('store')! : held[0]);
  }, [held, store, params]);

  const load = useCallback(async () => {
    const [{ data }, t] = await Promise.all([
      anyDb.from('stock_receipt').select(SELECT).order('created_at', { ascending: false }).limit(100),
      anyDb.from('stock_transfer').select('id', { count: 'exact', head: true }).eq('status', 'received'),
    ]);
    setRows((data ?? []) as Receipt[]);
    setTransfers(t.count ?? 0);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (part || register || partText.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(() => anyActions.rpc('search_stores', { p_text: partText.trim(), p_limit: 8 })
      .then(({ data }: { data: SearchRow[] | null }) => setMatches(data ?? [])), 250);
    return () => clearTimeout(t);
  }, [partText, part, register]);

  async function open(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    let partId = part?.part_id;
    if (!partId && register) {
      const { data, error: err } = await anyActions.rpc('add_part', {
        p_part_number: np.pn, p_description: np.desc, p_class: np.cls, p_unit: np.unit,
        p_shelf_life_tracked: np.shelf, p_serialised: np.serial,
      });
      if (err) { setBusy(false); return setError(errorText(err)); }
      partId = data as string;
    }
    if (!partId) { setBusy(false); return setError('Choose the part, or register a new one.'); }
    const { data, error: err } = await anyActions.rpc('open_receipt', {
      p_store: store, p_part: partId, p_qty: Number(f.qty), p_serial: f.serial || null, p_batch: f.batch || null,
      p_expiry: f.expiry || null, p_bin: f.bin || null, p_delivered_against: f.against || null,
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    navigate(`/stores/receiving/${data as string}`);
  }

  async function acknowledge(r: Receipt) {
    setError('');
    const { error: err } = await anyActions.rpc('acknowledge_receipt', { p_receipt: r.id });
    if (err) return setError(errorText(err));
    setMessage(`${r.number}: acknowledged; now Forward Store stock`);
    load();
  }

  const inspecting = (rows ?? []).filter((r) => r.status === 'inspecting');
  const toAck = (rows ?? []).filter((r) => r.status === 'awaiting_ack');
  const done = (rows ?? []).filter((r) => r.status === 'accepted' || r.status === 'quarantined').slice(0, 20);
  const iHoldRecord = record ? held.includes(record) : false;
  const receivingStores = stores.filter((s) => held.includes(s.code));

  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Stores search', to: '/stores' }, { label: 'Receiving inspection' }]} />
      <BackButton to="/stores/issue" label="Issue parts" />
      <StoresTabs />
      <PageHead title="Receiving inspection and part registration" sub="Release documents are attached before a part is accepted" />
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      {canReceive && receivingStores.length > 0 && (
        <Section title="Receive goods">
          <form className="st-form" onSubmit={open}>
            <div className="row st-row">
              <div>
                <label htmlFor="rc-store">Receive into store</label>
                <select id="rc-store" value={store} onChange={(e) => setStore(e.target.value)}>
                  {receivingStores.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
                {store && store !== record && <div className="small muted">Direct receipt at {store}: the Main Store is told and acknowledges it before it counts.</div>}
              </div>
              <div>
                <label htmlFor="rc-against">Delivered against</label>
                <input id="rc-against" value={f.against} onChange={(e) => setF({ ...f, against: e.target.value })} placeholder="PO, delivery note, supplier ref" />
              </div>
            </div>
            {part ? (
              <div className="mel-chosen">
                <span className="mono">{part.part_number}</span> · {part.description}
                <button type="button" className="link-button" onClick={() => setPart(null)}>Change</button>
              </div>
            ) : !register ? (
              <>
                <label htmlFor="rc-part">Part number or description</label>
                <input id="rc-part" value={partText} onChange={(e) => setPartText(e.target.value)} autoComplete="off" />
                {matches.length > 0 && (
                  <ul className="pick-list">
                    {matches.map((m) => (
                      <li key={m.part_id}><button type="button" onClick={() => setPart(m)}>
                        <span className="mono">{m.part_number}</span><span>{m.description}</span>
                      </button></li>
                    ))}
                  </ul>
                )}
                <button type="button" className="link-button" onClick={() => { setRegister(true); setNp({ ...np, pn: partText }); }}>Not in the catalogue: register a new part</button>
              </>
            ) : (
              <div className="option-box">
                <div className="row st-row">
                  <div><label htmlFor="np-pn">Part number</label><input id="np-pn" value={np.pn} onChange={(e) => setNp({ ...np, pn: e.target.value })} required /></div>
                  <div><label htmlFor="np-desc">Description</label><input id="np-desc" value={np.desc} onChange={(e) => setNp({ ...np, desc: e.target.value })} required /></div>
                </div>
                <div className="row st-row">
                  <div><label htmlFor="np-cls">Class</label>
                    <select id="np-cls" value={np.cls} onChange={(e) => setNp({ ...np, cls: e.target.value })}>
                      <option value="component">Component</option><option value="consumable">Consumable</option>
                    </select></div>
                  <div><label htmlFor="np-unit">Unit</label><input id="np-unit" value={np.unit} onChange={(e) => setNp({ ...np, unit: e.target.value })} /></div>
                </div>
                <label className="check"><input type="checkbox" checked={np.serial} onChange={(e) => setNp({ ...np, serial: e.target.checked })} /> Serialised (one serial number per unit)</label>
                <label className="check"><input type="checkbox" checked={np.shelf} onChange={(e) => setNp({ ...np, shelf: e.target.checked })} /> Shelf life tracked</label>
                <button type="button" className="link-button" onClick={() => setRegister(false)}>Choose from the catalogue instead</button>
              </div>
            )}
            <div className="row st-row">
              <div><label htmlFor="rc-qty">Quantity</label><input id="rc-qty" inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
              <div><label htmlFor="rc-sn">Serial number</label><input id="rc-sn" value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></div>
              <div><label htmlFor="rc-batch">Batch</label><input id="rc-batch" value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} /></div>
            </div>
            <div className="row st-row">
              <div><label htmlFor="rc-exp">Shelf life ends (if any)</label><input id="rc-exp" type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} /></div>
              <div><label htmlFor="rc-bin">Bin</label><input id="rc-bin" value={f.bin} onChange={(e) => setF({ ...f, bin: e.target.value })} /></div>
            </div>
            <div className="action-row"><button type="submit" disabled={busy}>{busy ? 'Opening…' : 'Start receiving inspection'}</button></div>
          </form>
        </Section>
      )}

      <Section title={`Being inspected (${inspecting.length})`}>
        {rows === null ? <p className="muted">Loading…</p> : inspecting.length === 0 ? <Empty>Nothing waiting for inspection.</Empty> : (
          <ul className="open-list">
            {inspecting.map((r) => (
              <li key={r.id}>
                <Link className="mono" to={`/stores/receiving/${r.id}`}>{r.number}</Link>
                <span>{qtyText(r.qty)} × {r.part?.description} <span className="mono small">{r.part?.part_number}</span></span>
                <span className="dept-tag">{r.store_code}</span>
                <span className="small muted">{r.delivered_against ?? ''} · {formatDateTime(r.created_at, display)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Forward receipts · Receipts to acknowledge (${toAck.length})`}>
        {toAck.length === 0 ? <Empty>No Forward Store receipts waiting for the Main Store.</Empty> : (
          <ul className="open-list">
            {toAck.map((r) => (
              <li key={r.id}>
                <Link className="mono" to={`/stores/receiving/${r.id}`}>{r.number}</Link>
                <span>{qtyText(r.qty)} × {r.part?.description} <span className="mono small">{r.part?.part_number}</span></span>
                <span className="small muted">inspected by <span className="mono">{r.inspector?.three_letter_code}</span> · {r.certificate_type}</span>
                {iHoldRecord && canReceive ? <button type="button" onClick={() => acknowledge(r)}>Acknowledge</button>
                  : <span className="small muted">Main Store to acknowledge</span>}
              </li>
            ))}
          </ul>
        )}
        {transfers > 0 && <p className="small">Transfers received and waiting for acknowledgement: <Link to="/stores/transfers">{transfers}</Link></p>}
      </Section>

      <Section title="Recently completed">
        {done.length === 0 ? <Empty>None yet.</Empty> : (
          <ul className="open-list">
            {done.map((r) => (
              <li key={r.id}>
                <Link className="mono" to={`/stores/receiving/${r.id}`}>{r.number}</Link>
                <span>{qtyText(r.qty)} × {r.part?.description}</span>
                <ReceiptChip status={r.status} />
                <span className="small muted">{r.inspected_at && formatDateTime(r.inspected_at, display)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------- release documents
type Doc = { id: string; kind: string; file_name: string; storage_path: string; created_at: string; superseded_by: string | null };

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
}

function ReleaseDocs({ receiptId, required, canUpload, onChange }: {
  receiptId: string; required: string[]; canUpload: boolean; onChange: () => void;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const { data } = await anyDb.from('attachment').select('id, kind, file_name, storage_path, created_at, superseded_by')
      .eq('record_table', 'stock_receipt').eq('record_id', receiptId).order('created_at');
    setDocs((data ?? []) as Doc[]);
  }, [receiptId]);
  useEffect(() => { load(); }, [load]);

  // The file goes into the store first, then its record (as components/Attachments.tsx).
  async function upload(kind: string, file: File | undefined) {
    setError('');
    if (!file) return;
    const problem = fileProblem(file);
    if (problem) return setError(problem);
    setBusy(kind);
    const path = `stock_receipt/${receiptId}/${newId()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80)}`;
    const up = await db.storage.from('attachments').upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(''); return setError(errorText(up.error)); }
    const { error: err } = await anyDb.from('attachment').insert({
      record_table: 'stock_receipt', record_id: receiptId, kind, file_name: file.name, mime_type: file.type,
      size_bytes: file.size, storage_path: path, uploaded_by: '00000000-0000-0000-0000-000000000000', // the database sets you (D-024)
      device_time: new Date().toISOString(),
    });
    setBusy('');
    if (err) return setError(errorText(err));
    await load();
    onChange();
  }

  async function openFile(d: Doc) {
    const tab = window.open('', '_blank');
    const { data, error: err } = await db.storage.from('attachments').createSignedUrl(d.storage_path, 120);
    if (err || !data) { tab?.close(); return setError(errorText(err)); }
    if (tab) { tab.opener = null; tab.location.href = data.signedUrl; } else window.location.href = data.signedUrl;
  }

  const kinds = ['release_certificate', 'serviceable_tag'];
  return (
    <div className="st-docs">
      <ul className="wo-evidence">
        {kinds.map((k) => {
          const have = docs.filter((d) => d.kind === k && !d.superseded_by);
          const need = required.includes(k);
          return (
            <li key={k} className={have.length ? 'have' : need ? 'need' : 'optional'}>
              <span className="wo-ev-mark" aria-hidden>{have.length ? '✓' : need ? '!' : '–'}</span>
              <span className="wo-ev-name">{DOC_LABEL[k]} {need ? '(required)' : '(optional)'}</span>
              {have.length > 0
                ? have.map((d) => <button key={d.id} type="button" className="link-button" onClick={() => openFile(d)}>Attached · {d.file_name}</button>)
                : <span className="small muted">{need ? 'Required · not attached' : 'Not attached'}</span>}
              {canUpload && (
                <label className="button outline-button st-upload">
                  {busy === k ? 'Uploading…' : 'Upload PDF or image'}
                  <input type="file" accept="application/pdf,image/*" className="visually-hidden"
                    onChange={(e) => upload(k, e.target.files?.[0])} />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}

// ------------------------------------------------------ one receipt
export function ReceiptPage() {
  const { id } = useParams();
  const { display } = useAuth();
  const navigate = useNavigate();
  const { held, stores } = useMyStores();
  const { canReceive } = useSupplyRights();
  const certs = useCertificateTypes();
  const [r, setR] = useState<Receipt | null | undefined>(undefined);
  const [missing, setMissing] = useState<string[]>([]);
  const [required, setRequired] = useState<string[]>([]);
  const [check, setCheck] = useState({ match: false, cond: false, type: '', ref: '', pin: '' });
  const [qReason, setQReason] = useState('');
  const [mode, setMode] = useState<'accept' | 'quarantine'>('accept');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data } = await anyDb.from('stock_receipt').select(SELECT).eq('id', id).maybeSingle();
    const rec = (data ?? null) as Receipt | null;
    setR(rec);
    if (!rec) return;
    const [m, s] = await Promise.all([
      anyActions.rpc('receipt_missing_documents', { p_receipt: rec.id }),
      anyDb.from('operator_setting_current').select('value').eq('key', 'stores.required_release_documents').maybeSingle(),
    ]);
    setMissing((m.data ?? []) as string[]);
    const v = (s.data as { value?: Record<string, string[]> } | null)?.value;
    setRequired(v && rec.part ? (v[rec.part.part_class] ?? []) : ['release_certificate', 'serviceable_tag']);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (r === undefined) return <div className="page muted">Loading…</div>;
  if (r === null) return <div className="page"><p>This receipt does not exist or is outside the stores you hold.</p></div>;

  const mine = canReceive && held.includes(r.store_code);
  const record = stores.find((s) => s.is_store_of_record)?.code;

  async function accept(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { data, error: err } = await anyActions.rpc('accept_receipt', {
      p_receipt: r!.id, p_certificate_type: check.type, p_certificate_ref: check.ref,
      p_pn_sn_match: check.match, p_condition_ok: check.cond, p_pin: check.pin,
    });
    if (err) return setError(errorText(err));
    if (data === 'accepted') return navigate(`/stores/parts/${r!.part_id}`);
    setMessage('Accepted at the Forward Store. The Main Store acknowledges it before it counts as stock.');
    load();
  }
  async function quarantine(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { error: err } = await anyActions.rpc('quarantine_receipt', { p_receipt: r!.id, p_reason: qReason });
    if (err) return setError(errorText(err));
    setMessage('Sent to quarantine.');
    load();
  }
  async function acknowledge() {
    const { error: err } = await anyActions.rpc('acknowledge_receipt', { p_receipt: r!.id });
    if (err) return setError(errorText(err));
    setMessage('Acknowledged; now in stock.');
    load();
  }

  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Receiving inspection', to: '/stores/receiving' }, { label: <span className="mono">{r.number}</span> }]} />
      <BackButton to="/stores/receiving" label="Receiving inspection" />
      <PageHead title={<>Incoming: <span className="mono">{r.number}</span> · {r.part?.description}</>}
        sub={<><span className="mono">{r.part?.part_number}</span> · {r.store_code}{r.delivered_against && ` · ${r.delivered_against}`}</>}>
        <ReceiptChip status={r.status} />
      </PageHead>
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <Section title="What arrived">
        <dl className="facts">
          <dt>Quantity</dt><dd className="mono">{qtyText(r.qty)}</dd>
          {r.serial_no && <><dt>Serial</dt><dd className="mono">{r.serial_no}</dd></>}
          {r.batch_no && <><dt>Batch</dt><dd className="mono">{r.batch_no}</dd></>}
          <dt>Shelf life ends</dt><dd>{r.shelf_life_expires_on ? formatPlainDate(r.shelf_life_expires_on, display) : r.part?.shelf_life_tracked ? <span className="danger-text">Not entered: required for this part</span> : '—'}</dd>
          {r.bin && <><dt>Bin</dt><dd className="mono">{r.bin}</dd></>}
          <dt>Opened</dt><dd><span className="mono">{r.opener?.three_letter_code}</span> · {formatDateTime(r.created_at, display)}</dd>
          {r.inspected_at && <><dt>Inspected</dt><dd><span className="mono">{r.inspector?.three_letter_code}</span> · {formatDateTime(r.inspected_at, display)}</dd></>}
          {r.certificate_type && <><dt>Certificate accepted</dt><dd>{r.certificate_type} · <span className="mono">{r.certificate_ref}</span></dd></>}
          {r.quarantine_reason && <><dt>Quarantine reason</dt><dd>{r.quarantine_reason}</dd></>}
          {r.acknowledged_at && <><dt>Acknowledged by Main</dt><dd><span className="mono">{r.acknowledger?.three_letter_code}</span> · {formatDateTime(r.acknowledged_at, display)}</dd></>}
        </dl>
      </Section>

      <Section title="Release documents">
        <ReleaseDocs receiptId={r.id} required={required} canUpload={mine && (r.status === 'inspecting' || r.status === 'quarantined')} onChange={load} />
      </Section>

      {r.status === 'awaiting_ack' && record && held.includes(record) && canReceive && (
        <div className="action-row"><button type="button" onClick={acknowledge}>Acknowledge receipt (Main Store)</button></div>
      )}

      {r.status === 'inspecting' && mine && (
        <Section title="Inspection">
          <div className="chips-row">
            <button type="button" className="fchip" aria-pressed={mode === 'accept'} onClick={() => setMode('accept')}>Accept to stock</button>
            <button type="button" className="fchip" aria-pressed={mode === 'quarantine'} onClick={() => setMode('quarantine')}>Send to quarantine</button>
          </div>
          {mode === 'accept' ? (
            <form onSubmit={accept}>
              <label className="check"><input type="checkbox" checked={check.match} onChange={(e) => setCheck({ ...check, match: e.target.checked })} /> Part number and serial / batch match the documents</label>
              <label className="check"><input type="checkbox" checked={check.cond} onChange={(e) => setCheck({ ...check, cond: e.target.checked })} /> Condition acceptable</label>
              <div className="row st-row">
                <div>
                  <label htmlFor="rc-ct">Certificate type (Quality's list)</label>
                  <select id="rc-ct" value={check.type} onChange={(e) => setCheck({ ...check, type: e.target.value })} required>
                    <option value="">Choose</option>
                    {certs.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="rc-cr">Certificate reference</label>
                  <input id="rc-cr" value={check.ref} onChange={(e) => setCheck({ ...check, ref: e.target.value })} required />
                </div>
              </div>
              {missing.length > 0 && (
                <div className="note warn">Attach first: {missing.map((k) => DOC_LABEL[k] ?? k).join(', ')}.</div>
              )}
              <PinField value={check.pin} onChange={(pin) => setCheck({ ...check, pin })} />
              <div className="action-row">
                <button type="submit" disabled={missing.length > 0}>Accept to stock{r.store_code !== record ? ' (report to Main)' : ''}</button>
              </div>
              <p className="small muted">Accepting records what you checked; the part becomes available only through this step, by Supply.</p>
            </form>
          ) : (
            <form onSubmit={quarantine}>
              <label htmlFor="rc-q">Reason</label>
              <input id="rc-q" value={qReason} onChange={(e) => setQReason(e.target.value)} required placeholder="e.g. Certificate missing, damaged in transit" />
              <div className="action-row"><button type="submit" className="danger-button secondary">Send to quarantine</button></div>
            </form>
          )}
        </Section>
      )}
      {r.lot_id && <Link to={`/stores/parts/${r.part_id}`}>Open part detail</Link>}
    </div>
  );
}
