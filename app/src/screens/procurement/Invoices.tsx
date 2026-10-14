// Supplier invoices on a purchase order or an outside-MRO job (D-077, D-144).
//
//   * COST: the whole section exists only for people with "View cost"; the
//     server sends no invoice to anyone else (D-077, D-121, D-127).
//   * The scan is an attachment on the invoice record ("supplier_invoice",
//     kind "invoice"): PDF or image only, never deleted (D-026, D-023). The
//     file goes into the store first, then its record (as Attachments.tsx).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, db, errorText } from '../../lib/supabase';
import { formatDateTime, formatPlainDate } from '../../lib/format';
import { fileProblem } from '../../components/Attachments';
import { Money, type Currency } from './common';

export type Invoice = {
  id: string; invoice_no: string; invoice_date: string; amount: number; currency: string; note: string | null;
  recorded_by?: string; created_at?: string;
};

type Doc = { id: string; file_name: string; storage_path: string; created_at: string; superseded_by: string | null };

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
}

// The scans on one invoice.
function InvoiceFiles({ invoiceId, canUpload }: { invoiceId: string; canUpload: boolean }) {
  const { display } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await anyDb.from('attachment').select('id, file_name, storage_path, created_at, superseded_by')
      .eq('record_table', 'supplier_invoice').eq('record_id', invoiceId).order('created_at');
    setDocs((data ?? []) as Doc[]);
  }, [invoiceId]);
  useEffect(() => { load(); }, [load]);

  async function upload(file: File | undefined) {
    setError('');
    if (!file) return;
    const problem = fileProblem(file);
    if (problem) return setError(problem);
    setBusy(true);
    const path = `supplier_invoice/${invoiceId}/${newId()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80)}`;
    const up = await db.storage.from('attachments').upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); return setError(errorText(up.error)); }
    const { error: err } = await anyDb.from('attachment').insert({
      record_table: 'supplier_invoice', record_id: invoiceId, kind: 'invoice', file_name: file.name, mime_type: file.type,
      size_bytes: file.size, storage_path: path, uploaded_by: '00000000-0000-0000-0000-000000000000', // the database sets you (D-024)
      device_time: new Date().toISOString(),
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    load();
  }

  async function openFile(d: Doc) {
    const tab = window.open('', '_blank');
    const { data, error: err } = await db.storage.from('attachments').createSignedUrl(d.storage_path, 120);
    if (err || !data) { tab?.close(); return setError(errorText(err)); }
    if (tab) { tab.opener = null; tab.location.href = data.signedUrl; } else window.location.href = data.signedUrl;
  }

  return (
    <div className="pq-files">
      {docs.length === 0 && <span className="small muted">No scan attached.</span>}
      {docs.map((d) => (
        <button key={d.id} type="button" className="link-button" onClick={() => openFile(d)}>
          {d.file_name}{d.superseded_by ? ' (superseded)' : ''}<span className="small muted"> · {formatDateTime(d.created_at, display)}</span>
        </button>
      ))}
      {canUpload && (
        <label className="button outline-button pq-upload">
          {busy ? 'Uploading…' : 'Upload invoice (PDF or image)'}
          <input type="file" accept="application/pdf,image/*" className="visually-hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}

// The invoices list with "Record invoice". `invoices` is null for people
// without "View cost" (the server sent none); then nothing is shown.
export function InvoicesSection({ invoices, currency, canRecord, purchaseOrderId, outsideMroJobId, onChange }: {
  invoices: Invoice[] | null; currency: Currency; canRecord: boolean;
  purchaseOrderId?: string; outsideMroJobId?: string; onChange: () => void;
}) {
  const { display } = useAuth();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ no: '', date: new Date().toISOString().slice(0, 10), amount: '', note: '' });
  const [error, setError] = useState('');
  if (invoices === null) return null;

  async function record(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { error: err } = await anyActions.rpc('record_invoice', {
      p_invoice_no: f.no, p_invoice_date: f.date, p_amount: Number(f.amount),
      p_purchase_order: purchaseOrderId ?? null, p_outside_mro_job: outsideMroJobId ?? null, p_note: f.note || null,
    });
    if (err) return setError(errorText(err));
    setOpen(false);
    setF({ ...f, no: '', amount: '', note: '' });
    onChange();
  }

  return (
    <div>
      {invoices.length === 0 && <p className="small muted">No invoice recorded yet.</p>}
      {invoices.length > 0 && (
        <ul className="pq-invoices">
          {invoices.map((i) => (
            <li key={i.id}>
              <div className="pq-inv-top">
                <span className="mono">{i.invoice_no}</span>
                <span className="small">{formatPlainDate(i.invoice_date, display)}</span>
                <Money value={i.amount} currency={currency} />
                {i.recorded_by && <span className="small muted">recorded by <span className="mono">{i.recorded_by}</span></span>}
              </div>
              {i.note && <div className="small">{i.note}</div>}
              <InvoiceFiles invoiceId={i.id} canUpload={canRecord} />
            </li>
          ))}
        </ul>
      )}
      {canRecord && !open && <div className="action-row"><button type="button" className="secondary" onClick={() => setOpen(true)}>Record invoice</button></div>}
      {open && (
        <form className="pq-form pq-inline" onSubmit={record}>
          <div className="row pq-row">
            <div><label htmlFor="inv-no">Supplier's invoice number</label><input id="inv-no" value={f.no} onChange={(e) => setF({ ...f, no: e.target.value })} required /></div>
            <div><label htmlFor="inv-date">Invoice date</label><input id="inv-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></div>
            <div><label htmlFor="inv-amt">Amount ({currency.code})</label><input id="inv-amt" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') })} required /></div>
          </div>
          <label htmlFor="inv-note">Note</label>
          <input id="inv-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="action-row"><button type="submit">Record invoice</button>
            <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button></div>
          <p className="small muted">Then attach the scan to it (PDF or image).</p>
        </form>
      )}
    </div>
  );
}
