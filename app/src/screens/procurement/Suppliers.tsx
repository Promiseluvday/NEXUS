// Approved supplier list (D-148): Quality owns it as configuration.
//   * Quality adds suppliers and suspends, withdraws or re-approves them,
//     with a reason, signed with PIN. Every change is kept (D-023).
//   * Procurement and Supply read it; a PO can only go to an approved
//     supplier, an outside-MRO job only to an approved MRO (the database
//     refuses anything else).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, errorText } from '../../lib/supabase';
import { formatDateTime } from '../../lib/format';
import { PinField } from '../../components/PinField';
import { BackButton, Crumbs, PageHead, Section } from '../../components/PageFrame';
import { Empty, ProcurementTabs, useProcurementRights } from './common';

type Supplier = {
  id: string; code: string; name: string; kind: 'parts' | 'mro' | 'both'; country: string | null; contact: string | null;
  approval_ref: string | null; scope_note: string | null; status: 'approved' | 'suspended' | 'withdrawn';
  status_reason: string | null; status_set_at: string | null; setter: { three_letter_code: string } | null;
};

const KIND: Record<string, string> = { parts: 'Parts', mro: 'MRO services', both: 'Parts and MRO' };
const STATUS_TONE: Record<string, string> = { approved: 'green', suspended: 'amber', withdrawn: 'red' };

export function Suppliers() {
  const { display } = useAuth();
  const { rights } = useProcurementRights();
  const [rows, setRows] = useState<Supplier[] | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [add, setAdd] = useState({ open: false, code: '', name: '', kind: 'parts', country: '', contact: '', ref: '', scope: '', pin: '' });
  const [change, setChange] = useState<{ id: string; status: string; reason: string; pin: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await anyDb.from('supplier')
      .select('id, code, name, kind, country, contact, approval_ref, scope_note, status, status_reason, status_set_at, setter:status_set_by (three_letter_code)')
      .order('status').order('name');
    if (err) setError(errorText(err));
    setRows((data ?? []) as Supplier[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addSupplier(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { error: err } = await anyActions.rpc('add_supplier', {
      p_code: add.code, p_name: add.name, p_kind: add.kind, p_pin: add.pin, p_country: add.country || null,
      p_contact: add.contact || null, p_approval_ref: add.ref || null, p_scope_note: add.scope || null,
    });
    if (err) return setError(errorText(err));
    setMessage(`${add.name} added to the approved list`);
    setAdd({ open: false, code: '', name: '', kind: 'parts', country: '', contact: '', ref: '', scope: '', pin: '' });
    load();
  }
  async function setStatus(e: FormEvent) {
    e.preventDefault();
    if (!change) return;
    setError('');
    const { error: err } = await anyActions.rpc('set_supplier_status', {
      p_supplier: change.id, p_status: change.status, p_reason: change.reason, p_pin: change.pin,
    });
    if (err) return setError(errorText(err));
    setMessage('Supplier status changed');
    setChange(null);
    load();
  }

  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Approved suppliers' }]} />
      <BackButton to="/" label="All aircraft" />
      <ProcurementTabs />
      <PageHead title="Approved suppliers" sub="Quality's approved supplier list. Orders go only to approved suppliers.">
        {rights.maintain_suppliers && !add.open && <button type="button" onClick={() => setAdd({ ...add, open: true })}>Add supplier</button>}
      </PageHead>
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}
      {!rights.maintain_suppliers && <p className="small muted">Only Quality changes this list.</p>}

      {add.open && (
        <Section title="Add to the approved list">
          <form className="pq-form" onSubmit={addSupplier}>
            <div className="row pq-row">
              <div><label htmlFor="su-code">Code</label><input id="su-code" value={add.code} onChange={(e) => setAdd({ ...add, code: e.target.value.toUpperCase() })} required placeholder="e.g. SUP-A" /></div>
              <div><label htmlFor="su-name">Name</label><input id="su-name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} required /></div>
              <div><label htmlFor="su-kind">Supplies</label>
                <select id="su-kind" value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value })}>
                  <option value="parts">Parts</option><option value="mro">MRO services</option><option value="both">Parts and MRO</option>
                </select></div>
            </div>
            <div className="row pq-row">
              <div><label htmlFor="su-country">Country</label><input id="su-country" value={add.country} onChange={(e) => setAdd({ ...add, country: e.target.value })} /></div>
              <div><label htmlFor="su-contact">Contact</label><input id="su-contact" value={add.contact} onChange={(e) => setAdd({ ...add, contact: e.target.value })} /></div>
              <div><label htmlFor="su-ref">Quality approval reference</label><input id="su-ref" value={add.ref} onChange={(e) => setAdd({ ...add, ref: e.target.value })} /></div>
            </div>
            <label htmlFor="su-scope">Approved for</label>
            <input id="su-scope" value={add.scope} onChange={(e) => setAdd({ ...add, scope: e.target.value })} placeholder="e.g. Seals, filters, consumables" />
            <PinField value={add.pin} onChange={(pin) => setAdd({ ...add, pin })} id="su-pin" />
            <div className="action-row"><button type="submit">Add supplier</button>
              <button type="button" className="secondary" onClick={() => setAdd({ ...add, open: false })}>Cancel</button></div>
          </form>
        </Section>
      )}

      {rows === null ? <p className="muted">Loading…</p> : rows.length === 0 ? <div className="box"><div className="box-body"><Empty>No suppliers yet.</Empty></div></div> : (
        <ul className="st-cards">
          {rows.map((s) => (
            <li key={s.id} className="box">
              <div className="box-body">
                <div className="pq-line-top">
                  <span className="mono">{s.code}</span><strong>{s.name}</strong>
                  <span className="dept-tag">{KIND[s.kind]}</span>
                  <span className={`chip tone-${STATUS_TONE[s.status]}`}>{s.status[0].toUpperCase() + s.status.slice(1)}</span>
                </div>
                <div className="small">{[s.scope_note, s.country, s.contact].filter(Boolean).join(' · ')}</div>
                <div className="small muted">
                  {s.approval_ref && <>Approval <span className="mono">{s.approval_ref}</span> · </>}
                  {s.status_reason}{s.setter && <> · <span className="mono">{s.setter.three_letter_code}</span></>}
                  {s.status_set_at && <> · {formatDateTime(s.status_set_at, display)}</>}
                </div>
                {rights.maintain_suppliers && change?.id !== s.id && (
                  <div className="action-row"><button type="button" className="secondary"
                    onClick={() => setChange({ id: s.id, status: s.status === 'approved' ? 'suspended' : 'approved', reason: '', pin: '' })}>Change status</button></div>
                )}
                {change?.id === s.id && (
                  <form className="pq-form pq-inline" onSubmit={setStatus}>
                    <div className="row pq-row">
                      <div><label htmlFor={`st-${s.id}`}>New status</label>
                        <select id={`st-${s.id}`} value={change.status} onChange={(e) => setChange({ ...change, status: e.target.value })}>
                          {['approved', 'suspended', 'withdrawn'].filter((x) => x !== s.status).map((x) => <option key={x} value={x}>{x}</option>)}
                        </select></div>
                      <div><label htmlFor={`rs-${s.id}`}>Reason</label>
                        <input id={`rs-${s.id}`} value={change.reason} onChange={(e) => setChange({ ...change, reason: e.target.value })} required /></div>
                    </div>
                    <PinField value={change.pin} onChange={(pin) => setChange({ ...change, pin })} id={`pin-${s.id}`} />
                    <div className="action-row"><button type="submit">Sign and change</button>
                      <button type="button" className="secondary" onClick={() => setChange(null)}>Cancel</button></div>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
