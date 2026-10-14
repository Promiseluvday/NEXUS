// Part requests: the form (WF-I3), the list for one tail or for me (WF-C3),
// one request (WF-I4), and the panel for the work order page.
//
// Rules the database enforces (migration 0029), shown here in words:
//   D-143  aircraft part: tail + work order; consumable: work order or a
//          stated purpose ("General use").
//   D-071, D-145  stock is reserved at SERVER time when the request arrives.
//          Without a connection the request waits on this tablet as
//          "Queued, not reserved" and nothing is held for it until it is sent.
//   D-068  reserved before the work order is approved; issued only after.
//   D-147  AOG: anyone may ask; confirmed if the tail is U/S or AOG, or by a
//          certifying engineer with PIN.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, errorText, hideRefs } from '../../lib/supabase';
import { enqueue } from '../../lib/offline/outbox';
import { isNetworkError, isOnline } from '../../lib/offline/net';
import { useOutbox } from '../../lib/offline/hooks';
import { formatDateTime, heldFor } from '../../lib/format';
import { AircraftPicker, useAircraftList } from '../../components/AircraftPicker';
import { PinField } from '../../components/PinField';
import { BackButton, Crumbs, PageHead, Section, TailHeader, TailTabs, type Crumb } from '../../components/PageFrame';
import { useFleetBoard } from '../FleetBoard';
import {
  Empty, LineStateChip, PriorityChip, lineStateLabel, qtyText, usePartRequestLines, useSupplyRights,
  type RequestLine, type Store,
} from './common';
import type { SearchRow } from './Search';

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type WoOption = { id: string; number: string; scope: string; status: string; aircraft_id: string };
const WO_OPEN = ['requested', 'pre_approved', 'open', 'work_complete'];

// ------------------------------------------------------------------ WF-I3
export function PartRequestForm() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const aircraft = useAircraftList();
  const outbox = useOutbox();

  const [partText, setPartText] = useState('');
  const [matches, setMatches] = useState<SearchRow[]>([]);
  const [part, setPart] = useState<SearchRow | null>(null);
  const [freeText, setFreeText] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState(params.get('store') ?? '');
  const [qty, setQty] = useState('1');
  const [type, setType] = useState<'aircraft_part' | 'consumable'>('aircraft_part');
  const [tail, setTail] = useState(params.get('aircraft') ?? '');
  const [wos, setWos] = useState<WoOption[]>([]);
  const [wo, setWo] = useState(params.get('wo') ?? '');
  const [generalUse, setGeneralUse] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [priority, setPriority] = useState('ROUTINE');
  const [requiredBy, setRequiredBy] = useState('');
  const [position, setPosition] = useState('');
  const [ipc, setIpc] = useState('');
  const [removed, setRemoved] = useState('not_applicable');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [queued, setQueued] = useState('');

  // The part opened from Part detail (?part=).
  useEffect(() => {
    const id = params.get('part');
    if (!id) return;
    anyDb.from('part').select('part_number').eq('id', id).maybeSingle().then(async ({ data }: { data: { part_number: string } | null }) => {
      if (!data) return;
      const { data: rows } = await anyActions.rpc('search_stores', { p_text: data.part_number, p_limit: 5 });
      const found = ((rows ?? []) as SearchRow[]).find((r) => r.part_id === id) ?? null;
      setPart(found);
      if (found?.part_class === 'consumable') setType('consumable');
    });
  }, [params]);

  useEffect(() => {
    anyDb.from('store').select('code, name, is_store_of_record').order('is_store_of_record', { ascending: false })
      .then(({ data }: { data: Store[] | null }) => {
        setStores(data ?? []);
        if (!store && data?.length) setStore(data[0].code);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Work orders still in progress on the chosen tail.
  useEffect(() => {
    let q = anyDb.from('work_order').select('id, number, scope, status, aircraft_id').in('status', WO_OPEN)
      .order('created_at', { ascending: false }).limit(100);
    if (tail) q = q.eq('aircraft_id', tail);
    q.then(({ data }: { data: WoOption[] | null }) => setWos(data ?? []));
  }, [tail]);

  // Type-ahead on the catalogue.
  useEffect(() => {
    if (part || freeText || partText.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(() => {
      anyActions.rpc('search_stores', { p_text: partText.trim(), p_limit: 8 })
        .then(({ data }: { data: SearchRow[] | null }) => setMatches(data ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [partText, part, freeText]);

  const avail = part?.stores.find((s) => s.store === store)?.available;
  const tailName = aircraft.find((a) => a.id === tail)?.tail;
  const myQueued = outbox.filter((i) => i.action === 'request_part' && i.status !== 'sent');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!part && !(freeText && partText.trim())) return setError('Choose a part from the catalogue, or type its part number.');
    const n = Number(qty);
    if (!(n > 0)) return setError('Enter a quantity above zero.');
    if (type === 'aircraft_part' && (!tail || !wo)) return setError('An aircraft part needs a tail and a work order.');
    if (type === 'consumable' && !wo && !(generalUse && purpose.trim())) {
      return setError('A consumable needs a work order, or "General use" with a stated purpose.');
    }
    const args = {
      p_request_type: type, p_store: store, p_qty: n,
      p_part: part?.part_id ?? null, p_part_number_text: part ? null : partText.trim(),
      p_aircraft: tail || null, p_work_order: wo || null,
      p_purpose: type === 'consumable' && generalUse ? purpose.trim() : null,
      p_priority: priority, p_required_by: requiredBy ? new Date(requiredBy).toISOString() : null,
      p_position: position || null, p_ipc_ref: ipc || null, p_removed_part: removed,
      p_remarks: remarks || null, p_client_ref: newId(), p_device_time: new Date().toISOString(),
    };
    const label = `Part request: ${qtyText(n)} × ${part?.part_number ?? partText.trim()}${tailName ? ` · ${tailName}` : ''}`;
    // No connection: keep it on the tablet. Nothing is reserved until the
    // server receives it (D-145).
    const queueIt = async () => {
      await enqueue({ userId: me!.userId, kind: 'rpc', action: 'request_part', args, label,
        recordPath: '/part-requests', aircraftId: tail || undefined });
      setBusy(false);
      setQueued(`${label}: Queued, not reserved. It is sent when the connection returns; stock is held only once the server has it.`);
    };
    setBusy(true);
    if (!isOnline()) return queueIt();
    const { data, error: err } = await anyActions.rpc('request_part', args);
    if (err && isNetworkError(err)) return queueIt();
    setBusy(false);
    if (err) return setError(errorText(err));
    navigate(`/part-requests/${(data as { id: string }).id}`);
  }

  const back = tail ? `/part-requests?aircraft=${tail}` : '/stores';
  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' },
        ...(tail ? [{ label: <span className="mono">{tailName ?? '…'}</span>, to: `/aircraft/${tail}` }, { label: 'Part requests', to: back }]
                 : [{ label: 'Stores search', to: '/stores' }]),
        { label: 'Part request form' }]} />
      <BackButton to={back} label={tail ? 'Part requests' : 'Stores search'} />
      <PageHead title="Part request" sub="Stock is reserved by the server the moment it receives the request" />

      {myQueued.length > 0 && (
        <div className="offline-banner" role="status">
          {myQueued.map((i) => <div key={i.id}>{i.label} · <strong>Queued, not reserved</strong>{i.status === 'failed' && ` · refused: ${hideRefs(i.error ?? '')}`}</div>)}
        </div>
      )}
      {queued && <div className="offline-banner" role="status">{queued}</div>}

      <form className="st-form" onSubmit={submit}>
        <Section title="Part">
          {part ? (
            <div className="mel-chosen">
              <div><span className="mono">{part.part_number}</span> · {part.description}</div>
              <div className="small">{part.stores.map((s) => `${s.name} ${qtyText(s.available)} available`).join(' · ') || 'No store granted'}</div>
              <button type="button" className="link-button" onClick={() => { setPart(null); setPartText(''); }}>Choose another part</button>
            </div>
          ) : (
            <>
              <label htmlFor="pr-part">Part number or description</label>
              <input id="pr-part" value={partText} onChange={(e) => setPartText(e.target.value)} autoComplete="off" />
              {matches.length > 0 && (
                <ul className="pick-list">
                  {matches.map((m) => (
                    <li key={m.part_id}>
                      <button type="button" onClick={() => { setPart(m); if (m.part_class === 'consumable') setType('consumable'); }}>
                        <span className="mono">{m.part_number}</span>
                        <span>{m.description}</span>
                        <span className="small">{m.stores.map((s) => `${s.name.replace(' Store', '')} ${qtyText(s.available)}`).join(' · ')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="check">
                <input type="checkbox" checked={freeText} onChange={(e) => setFreeText(e.target.checked)} />
                Not in the catalogue: request by part number (Supply catalogues it; it needs a requisition)
              </label>
            </>
          )}
          <div className="row st-row">
            <div>
              <label htmlFor="pr-store">Store</label>
              <select id="pr-store" value={store} onChange={(e) => setStore(e.target.value)}>
                {stores.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
              {part && <div className="small muted">{avail === undefined ? 'You do not hold this store.' : `${qtyText(avail)} available`}</div>}
            </div>
            <div>
              <label htmlFor="pr-qty">Quantity{part ? ` (${part.unit})` : ''}</label>
              <input id="pr-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))} />
            </div>
          </div>
        </Section>

        <Section title="Request type">
          <label className="check">
            <input type="radio" name="pr-type" checked={type === 'aircraft_part'} onChange={() => setType('aircraft_part')} />
            Aircraft part: tail and a work order are required
          </label>
          <label className="check">
            <input type="radio" name="pr-type" checked={type === 'consumable'} onChange={() => setType('consumable')} />
            Consumable: no snag needed; link a work order or choose General use
          </label>
          <div className="row st-row">
            <div>
              <label htmlFor="pr-tail">Aircraft (tail){type === 'consumable' && ', optional'}</label>
              <AircraftPicker id="pr-tail" aircraft={aircraft} value={tail} onChange={(v) => { setTail(v); setWo(''); }}
                placeholder={type === 'consumable' ? 'No tail' : 'Choose aircraft'} />
            </div>
            <div>
              <label htmlFor="pr-wo">Work order{type === 'consumable' && ', optional'}</label>
              <select id="pr-wo" value={wo} onChange={(e) => {
                setWo(e.target.value);
                const w = wos.find((x) => x.id === e.target.value);
                if (w && !tail) setTail(w.aircraft_id);
              }}>
                <option value="">{type === 'consumable' ? 'No work order' : 'Choose work order'}</option>
                {wos.map((w) => <option key={w.id} value={w.id}>{w.number} · {w.scope.slice(0, 50)}{['requested', 'pre_approved'].includes(w.status) ? ' (awaiting approval)' : ''}</option>)}
              </select>
              {wo && ['requested', 'pre_approved'].includes(wos.find((w) => w.id === wo)?.status ?? '') && (
                <div className="small muted">Not approved yet: the part can be reserved now and is issued after approval.</div>
              )}
            </div>
          </div>
          {type === 'consumable' && (
            <>
              <label className="check">
                <input type="checkbox" checked={generalUse} onChange={(e) => setGeneralUse(e.target.checked)} />
                General use
              </label>
              {generalUse && (
                <>
                  <label htmlFor="pr-purpose">Purpose (required for General use)</label>
                  <input id="pr-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                </>
              )}
            </>
          )}
        </Section>

        <Section title="Details">
          <div className="row st-row">
            <div>
              <label htmlFor="pr-priority">Priority</label>
              <select id="pr-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="AOG">AOG</option>
              </select>
              {priority === 'AOG' && <div className="small muted">Confirmed if the tail is set U/S or AOG; otherwise a certifying engineer confirms it.</div>}
            </div>
            <div>
              <label htmlFor="pr-by">Required by</label>
              <input id="pr-by" type="datetime-local" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
            </div>
          </div>
          <div className="row st-row">
            <div>
              <label htmlFor="pr-pos">Position (tracked components)</label>
              <input id="pr-pos" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. No. 2 engine, L/H MLG" />
            </div>
            <div>
              <label htmlFor="pr-ipc">IPC / manual reference</label>
              <input id="pr-ipc" value={ipc} onChange={(e) => setIpc(e.target.value)} />
            </div>
          </div>
          <label htmlFor="pr-removed">Removed part</label>
          <select id="pr-removed" value={removed} onChange={(e) => setRemoved(e.target.value)}>
            <option value="not_applicable">Not applicable</option>
            <option value="serviceable">Serviceable</option>
            <option value="unserviceable">Unserviceable (expected back at stores as a U/S return)</option>
          </select>
          <label htmlFor="pr-remarks">Remarks</label>
          <textarea id="pr-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Section>

        {error && <div className="error" role="alert">{error}</div>}
        <div className="action-row">
          <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit request'}</button>
          <Link className="button outline-button" to={back}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}

// A table of request lines (with phone cards). Used by lists and panels.
export function RequestLinesTable({ lines, showTail = true, showStore = false, action }: {
  lines: RequestLine[]; showTail?: boolean; showStore?: boolean; action?: (l: RequestLine) => ReactNode;
}) {
  const navigate = useNavigate();
  const open = (l: RequestLine) => navigate(`/part-requests/${l.request_id}`);
  return (
    <>
      <table className="board st-table">
        <thead>
          <tr>
            <th>Request</th>{showTail && <th>Tail</th>}<th>Part</th><th>Qty</th><th>Priority</th><th>State</th><th>Holder</th><th>Held for</th>
            {showStore && <th>Store</th>}{action && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.line_id} tabIndex={0} onClick={() => open(l)} onKeyDown={(e) => e.key === 'Enter' && open(l)}>
              <td><Link className="mono" to={`/part-requests/${l.request_id}`} onClick={(e) => e.stopPropagation()}>{l.request_number}</Link>
                {l.line_no > 1 && <span className="small muted"> · line {l.line_no}</span>}</td>
              {showTail && <td className="tail">{l.tail ?? <span className="muted">—</span>}</td>}
              <td>{l.description ?? ''} <span className="mono small">{l.part_number}</span></td>
              <td className="mono">{qtyText(l.qty)}</td>
              <td><PriorityChip priority={l.priority} confirmed={l.aog_confirmed} /></td>
              <td><LineStateChip line={l} />{l.lot_problem && <div className="small danger-text">Stock problem: {l.lot_problem}</div>}</td>
              <td>{l.holder ? <span className="dept-tag">{l.holder}</span> : <span className="muted">—</span>}</td>
              <td className="mono small">{l.holder ? heldFor(l.held_since) : '—'}</td>
              {showStore && <td><span className="dept-tag">{l.store_code}</span></td>}
              {action && <td onClick={(e) => e.stopPropagation()}>{action(l)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cards">
        {lines.map((l) => (
          <div key={l.line_id} className="card tail-card" role="link" tabIndex={0} onClick={() => open(l)}
            onKeyDown={(e) => e.key === 'Enter' && open(l)}>
            <div className="top">
              <span><span className="mono">{l.request_number}</span>{showTail && l.tail && <> · <span className="tail">{l.tail}</span></>}</span>
              <PriorityChip priority={l.priority} confirmed={l.aog_confirmed} />
            </div>
            <div style={{ margin: '6px 0' }}>{qtyText(l.qty)} × {l.description ?? ''} <span className="mono small">{l.part_number}</span></div>
            <div className="chip-row"><LineStateChip line={l} />
              {l.holder && <span className="small muted">With {l.holder} · {heldFor(l.held_since)}</span>}</div>
            {action && <div className="action-row" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>{action(l)}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ WF-C3
// /part-requests?aircraft=<id>  this tail's requests (aircraft page tab)
// /part-requests                every open request I may see
export function PartRequestList() {
  const [params, setParams] = useSearchParams();
  const tail = params.get('aircraft') ?? '';
  const all = params.get('view') === 'all';
  const { rows } = useFleetBoard();
  const row = rows.find((r) => r.aircraft_id === tail);
  const { lines, error } = usePartRequestLines({ aircraftId: tail || undefined, openOnly: !all });
  const { isEngineer } = useSupplyRights();
  const outbox = useOutbox();
  const queued = outbox.filter((i) => i.action === 'request_part' && i.status !== 'sent' && (!tail || i.aircraftId === tail));

  const crumbs: Crumb[] = tail
    ? [{ label: 'All aircraft', to: '/' }, { label: <span className="mono">{row?.tail ?? '…'}</span>, to: `/aircraft/${tail}` }, { label: 'Part requests' }]
    : [{ label: 'All aircraft', to: '/' }, { label: 'Part requests' }];
  return (
    <div className="page st-page">
      <Crumbs items={crumbs} />
      {tail ? <BackButton to={`/aircraft/${tail}`} label={`${row?.tail ?? 'aircraft'} overview`} /> : <BackButton to="/" label="All aircraft" />}
      {row && <TailHeader row={row} />}
      {tail && <TailTabs aircraftId={tail} />}
      <PageHead title="Part requests" sub={tail ? 'This aircraft · AOG first' : 'Requests you may see · AOG first'}>
        {isEngineer && <Link className="button" to={`/part-requests/new${tail ? `?aircraft=${tail}` : ''}`}>New part request</Link>}
      </PageHead>
      <div className="wo-filters">
        <select aria-label="Which requests" value={all ? 'all' : 'open'} onChange={(e) => {
          const n = new URLSearchParams(params);
          if (e.target.value === 'all') n.set('view', 'all'); else n.delete('view');
          setParams(n, { replace: true });
        }}>
          <option value="open">Show: Open</option>
          <option value="all">Show: All, including closed</option>
        </select>
      </div>
      {queued.length > 0 && (
        <div className="offline-banner" role="status">
          {queued.map((i) => <div key={i.id}>{i.label} · <strong>Queued, not reserved</strong></div>)}
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {lines === null && <p className="muted">Loading…</p>}
      {lines?.length === 0 && <div className="box"><div className="box-body"><Empty>No part requests.</Empty></div></div>}
      {lines && lines.length > 0 && <RequestLinesTable lines={lines} showTail={!tail} />}
    </div>
  );
}

// ------------------------------------------------------- work order panel
// For the lead to drop into the work order page:
//   <Section title="Parts"><PartRequestsForWorkOrder workOrderId={wo.id} aircraftId={wo.aircraft_id} status={wo.status} /></Section>
export function PartRequestsForWorkOrder({ workOrderId, aircraftId, status }: {
  workOrderId: string; aircraftId: string; status: string;
}) {
  const { lines } = usePartRequestLines({ workOrderId, openOnly: false });
  const { isEngineer } = useSupplyRights();
  const canRequest = isEngineer && ['requested', 'pre_approved', 'open', 'work_complete'].includes(status);
  return (
    <div className="st-wo-parts">
      {lines === null && <p className="small muted">Loading…</p>}
      {lines?.length === 0 && <Empty>No parts requested on this work order.</Empty>}
      {lines && lines.length > 0 && (
        <ul className="open-list">
          {lines.map((l) => (
            <li key={l.line_id}>
              <Link className="mono" to={`/part-requests/${l.request_id}`}>{l.request_number}</Link>
              <span>{qtyText(l.qty)} × {l.description ?? l.part_number}</span>
              <LineStateChip line={l} />
              {l.holder && <span className="small muted">With {l.holder} · {heldFor(l.held_since)}</span>}
            </li>
          ))}
        </ul>
      )}
      {(status === 'requested' || status === 'pre_approved') && lines && lines.some((l) => l.state === 'reserved') && (
        <p className="small muted">Reserved parts are issued once Quality and the CO approve this work order.</p>
      )}
      {canRequest && (
        <div className="action-row">
          <Link className="button outline-button" to={`/part-requests/new?aircraft=${aircraftId}&wo=${workOrderId}`}>Request part</Link>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ WF-I4
type Header = {
  id: string; number: string; request_type: string; purpose: string | null; priority: string; status: string;
  aog_confirmed_at: string | null; aog_confirmed_how: string | null; created_at: string; required_by: string | null;
  remarks: string | null; cancel_reason: string | null; aircraft_id: string | null; store_code: string;
  aircraft: { tail: string; aircraft_type_code: string } | null;
  requester: { three_letter_code: string } | null; confirmer: { three_letter_code: string } | null;
};

// The steps a line goes through, as the wireframe's step line.
function LineSteps({ l }: { l: RequestLine }) {
  const viaPurchase = ['needs_requisition', 'on_order'].includes(l.state);
  const steps = viaPurchase
    ? ['Requested', 'Stock check: not in stock', 'Requisition', 'Purchase', 'Receiving', 'Reserved', 'Issued']
    : ['Requested', 'Stock check', 'Reserved', 'Issued', l.state === 'returned' ? 'Returned unused' : 'Fitted / used'];
  const at = viaPurchase
    ? (l.state === 'needs_requisition' ? 2 : 3)
    : ({ submitted: 1, reserved: 2, issued: 3, returning: 3, fitted: 5, returned: 5 } as Record<string, number>)[l.state] ?? 0;
  if (l.state === 'cancelled') return <p className="small muted">Cancelled{l.state_reason && `: ${l.state_reason}`}</p>;
  return (
    <ol className="wo-steps" aria-label="Request steps">
      {steps.map((name, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'todo';
        return <li key={name} className={`wo-step ${state}`}><span aria-hidden>{({ done: '✓', now: '●', todo: '○' } as Record<string, string>)[state]}</span> {name}</li>;
      })}
    </ol>
  );
}

export function PartRequestPage() {
  const { id } = useParams();
  const { me, display } = useAuth();
  const [h, setH] = useState<Header | null | undefined>(undefined);
  const { lines, reload } = usePartRequestLines({ requestId: id, openOnly: false });
  const { isEngineer, canIssue, canReceive } = useSupplyRights();
  const [canCertify, setCanCertify] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [serial, setSerial] = useState('');
  const [cond, setCond] = useState('serviceable');
  const [mode, setMode] = useState<{ kind: string; line?: RequestLine } | null>(null);

  const loadHeader = useCallback(async () => {
    const { data } = await anyDb.from('part_request')
      .select(`id, number, request_type, purpose, priority, status, aog_confirmed_at, aog_confirmed_how, created_at,
               required_by, remarks, cancel_reason, aircraft_id, store_code,
               aircraft:aircraft_id (tail, aircraft_type_code), requester:requested_by (three_letter_code),
               confirmer:aog_confirmed_by (three_letter_code)`)
      .eq('id', id).maybeSingle();
    setH((data ?? null) as Header | null);
    const ac = (data as Header | null)?.aircraft;
    if (me && ac) {
      const { data: c } = await anyActions.rpc('is_certifying', { p_person: me.personId, p_aircraft_type: ac.aircraft_type_code });
      setCanCertify(c === true);
    }
  }, [id, me]);
  useEffect(() => { loadHeader(); }, [loadHeader]);

  if (h === undefined) return <div className="page muted">Loading…</div>;
  if (h === null) return <div className="page"><p>This part request does not exist or is outside what you may see.</p></div>;

  const reset = () => { setMode(null); setPin(''); setReason(''); setSerial(''); setCond('serviceable'); };
  async function act(fn: string, args: Record<string, unknown>, done: string) {
    setError(''); setMessage('');
    const { data, error: err } = await anyActions.rpc(fn, args);
    if (err) return setError(errorText(err));
    setMessage(typeof data === 'string' && fn === 'issue_part' ? `${done}: issue voucher ${data}` : done);
    reset();
    reload(); loadHeader();
  }

  const mine = h.requester?.three_letter_code === me?.tlc;
  const listLink = h.aircraft_id ? `/part-requests?aircraft=${h.aircraft_id}` : '/part-requests';
  const first = lines?.[0];

  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' },
        ...(h.aircraft ? [{ label: <span className="mono">{h.aircraft.tail}</span>, to: `/aircraft/${h.aircraft_id}` }] : []),
        { label: 'Part requests', to: listLink }, { label: <span className="mono">{h.number}</span> }]} />
      <BackButton to={listLink} label="Part requests" />
      <PageHead title={<><span className="mono">{h.number}</span>{h.aircraft && <> · <span className="mono">{h.aircraft.tail}</span></>}</>}
        sub={first ? `${first.description ?? ''} ${first.part_number}` : undefined}>
        <PriorityChip priority={h.priority} confirmed={Boolean(h.aog_confirmed_at)} />
        {h.status !== 'open' && <span className="chip tone-grey">{h.status === 'closed' ? 'Closed' : 'Cancelled'}</span>}
      </PageHead>

      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <Section title="Request">
        <dl className="facts">
          <dt>Type</dt><dd>{h.request_type === 'aircraft_part' ? 'Aircraft part' : 'Consumable'}{h.purpose && ` · General use: ${h.purpose}`}</dd>
          <dt>Work order</dt><dd>{first?.work_order_number
            ? (isEngineer ? <Link className="mono" to={`/work-orders/${first.work_order_id}`}>{first.work_order_number}</Link> : <span className="mono">{first.work_order_number}</span>)
            : <span className="muted">—</span>}</dd>
          <dt>Store</dt><dd>{first?.store_name ?? h.store_code}</dd>
          <dt>Requested</dt><dd><span className="mono">{h.requester?.three_letter_code}</span> · {formatDateTime(h.created_at, display)}</dd>
          {h.required_by && <><dt>Required by</dt><dd>{formatDateTime(h.required_by, display)}</dd></>}
          {h.priority === 'AOG' && <><dt>AOG</dt><dd>{h.aog_confirmed_at
            ? `Confirmed ${h.aog_confirmed_how === 'tail_status' ? 'by the tail status (U/S or AOG)' : `by ${h.confirmer?.three_letter_code ?? 'a certifying engineer'}`} · ${formatDateTime(h.aog_confirmed_at, display)}`
            : 'Not confirmed yet'}</dd></>}
          {first?.fit_position && <><dt>Position</dt><dd>{first.fit_position}</dd></>}
          {first?.ipc_ref && <><dt>IPC reference</dt><dd>{first.ipc_ref}</dd></>}
          {h.remarks && <><dt>Remarks</dt><dd>{h.remarks}</dd></>}
          {h.cancel_reason && <><dt>Cancelled</dt><dd>{h.cancel_reason}</dd></>}
        </dl>
      </Section>

      {(lines ?? []).map((l) => (
        <Section key={l.line_id} title={<>Line {l.line_no} · {qtyText(l.qty)} {l.unit ?? ''} × <span className="mono">{l.part_number}</span></>}
          actions={<LineStateChip line={l} />}>
          <LineSteps l={l} />
          <div className="small">
            {lineStateLabel(l)}{l.holder && <> · Holder now <span className="dept-tag">{l.holder}</span> · held {heldFor(l.held_since)}</>}
          </div>
          {l.state_reason && <div className="small muted">{l.state_reason}</div>}
          {l.lot_id && <div className="small">Stock: <span className="mono">{l.serial_no ? `SN ${l.serial_no}` : l.batch_no ? `Batch ${l.batch_no}` : ''}</span>{l.bin && <> · Bin <span className="mono">{l.bin}</span></>}</div>}
          {l.issue_voucher && <div className="small">Issue voucher <span className="mono">{l.issue_voucher}</span></div>}
          {l.lot_problem && <div className="note warn">This stock cannot be issued: {l.lot_problem}. Supply moves it to quarantine and reserves again.</div>}
          {l.state === 'needs_requisition' && <div className="small muted">Supply raises a requisition; Procurement then orders it.</div>}

          <div className="action-row">
            {canIssue && l.state === 'reserved' && <button type="button" onClick={() => setMode({ kind: 'issue', line: l })}>Issue</button>}
            {canIssue && l.state === 'reserved' && <button type="button" className="secondary" onClick={() => setMode({ kind: 'release', line: l })}>Release reservation</button>}
            {(canIssue || canReceive) && l.state === 'returning' && <button type="button" onClick={() => setMode({ kind: 'accept_return', line: l })}>Take back into stores</button>}
            {(isEngineer || canIssue) && ['submitted', 'needs_requisition'].includes(l.state) && h.status === 'open' && (
              <button type="button" className="secondary" onClick={() => act('reserve_line', { p_line: l.line_id }, 'Checked stock again')}>Check stock again</button>
            )}
            {isEngineer && l.state === 'issued' && <button type="button" onClick={() => setMode({ kind: 'fitted', line: l })}>Record fitted / used</button>}
            {isEngineer && l.state === 'issued' && <button type="button" className="secondary" onClick={() => setMode({ kind: 'return', line: l })}>Return unused</button>}
          </div>

          {mode?.line?.line_id === l.line_id && (
            <form className="st-inline" onSubmit={(e) => {
              e.preventDefault();
              if (mode.kind === 'issue') act('issue_part', { p_line: l.line_id, p_pin: pin }, 'Issued');
              if (mode.kind === 'release') act('release_reservation', { p_line: l.line_id, p_reason: reason }, 'Reservation released');
              if (mode.kind === 'accept_return') act('accept_returned_part', { p_line: l.line_id, p_condition: cond, p_reason: reason || null }, 'Taken back into stores');
              if (mode.kind === 'fitted') act('record_part_fitted', { p_line: l.line_id, p_note: reason || null, p_removed_serial: serial || null }, 'Recorded as fitted');
              if (mode.kind === 'return') act('return_unused_part', { p_line: l.line_id, p_reason: reason }, 'Return to stores started');
            }}>
              {mode.kind === 'issue' && (
                <>
                  <p className="small">Check part number, serial or batch and certificate at the counter before signing.</p>
                  <PinField value={pin} onChange={setPin} />
                </>
              )}
              {mode.kind === 'accept_return' && (
                <>
                  <label htmlFor="ret-cond">Condition on return</label>
                  <select id="ret-cond" value={cond} onChange={(e) => setCond(e.target.value)}>
                    <option value="serviceable">Serviceable: back to stock</option>
                    <option value="quarantine">Quarantine</option>
                  </select>
                </>
              )}
              {mode.kind === 'fitted' && l.removed_part === 'unserviceable' && (
                <>
                  <label htmlFor="rm-sn">Serial number of the removed part (sent to stores as a U/S return)</label>
                  <input id="rm-sn" value={serial} onChange={(e) => setSerial(e.target.value)} />
                </>
              )}
              {mode.kind !== 'issue' && (
                <>
                  <label htmlFor="act-reason">{mode.kind === 'fitted' ? 'Note (optional)' : mode.kind === 'accept_return' ? 'Reason (required for quarantine)' : 'Reason'}</label>
                  <input id="act-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                </>
              )}
              <div className="action-row">
                <button type="submit">Confirm</button>
                <button type="button" className="secondary" onClick={reset}>Cancel</button>
              </div>
            </form>
          )}
        </Section>
      ))}

      {h.status === 'open' && (
        <div className="action-row">
          {h.priority === 'AOG' && !h.aog_confirmed_at && canCertify && (
            <button type="button" onClick={() => setMode({ kind: 'aog' })}>Confirm AOG priority</button>
          )}
          {(isEngineer || mine) && lines && !lines.some((l) => ['issued', 'returning'].includes(l.state)) && (
            <button type="button" className="secondary danger-button" onClick={() => setMode({ kind: 'cancel' })}>Cancel request</button>
          )}
          <Link className="button outline-button" to={h.aircraft_id ? `/aircraft/${h.aircraft_id}` : '/stores'}>
            {h.aircraft_id ? 'Back to aircraft' : 'Back to stores'}
          </Link>
        </div>
      )}
      {mode && !mode.line && (
        <form className="box st-inline" onSubmit={(e) => {
          e.preventDefault();
          if (mode.kind === 'aog') act('confirm_aog_priority', { p_request: h.id, p_pin: pin }, 'AOG priority confirmed');
          if (mode.kind === 'cancel') act('cancel_part_request', { p_request: h.id, p_reason: reason }, 'Request cancelled; reservations released');
        }}>
          <div className="box-body">
            {mode.kind === 'aog' && <><p className="small">You confirm, as a certifying engineer, that this part is needed to return an aircraft on ground to service.</p><PinField value={pin} onChange={setPin} /></>}
            {mode.kind === 'cancel' && <><label htmlFor="cx-reason">Reason for cancelling</label><input id="cx-reason" value={reason} onChange={(e) => setReason(e.target.value)} required /></>}
            <div className="action-row">
              <button type="submit">Confirm</button>
              <button type="button" className="secondary" onClick={reset}>Back</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
