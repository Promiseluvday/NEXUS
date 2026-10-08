// Deferred Defects Log Sheet (D-163, D-164, workflows/ddls.md).
//
// One sheet per tail, page by page, like the paper DDLS. Every MEL deferral
// arrives here automatically; non-MEL airworthiness deferrals are placed here
// by the engineer. Each open entry shows its limit as written and, for
// calendar limits, the time left (simple subtraction, D-054). When the limit
// passes it shows "Limit exceeded" in red; Nexus never grounds the aircraft
// (D-020, D-057).
//
// Engineers can:
//   Clear an entry   → rectification, TLB reference, PIN; closes the snag
//   Request extension → a separate approval (D-056); never for categories the
//                       operator excludes (PAF: Cat A, D-163): the button
//                       does not exist for them.
import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { PinField } from '../components/PinField';

export type DdlsEntry = {
  id: string; page_no: number; entry_no: number; kind: string; status: string;
  mel_ref: string | null; mel_category: string | null; manual_reference: string | null; days_allowed: number | null;
  interval_value: number | null; interval_unit: string | null;
  defect_text: string; m_required: boolean; o_required: boolean; remarks: string | null;
  tlb_book: string | null; tlb_page: string | null; tlb_item: string | null;
  deferred_at: string; due_at: string | null; limit_text: string | null;
  cleared_at: string | null; rectification: string | null; rect_tlb_book: string | null; rect_tlb_page: string | null;
  snag_id: string;
  deferrer: { three_letter_code: string } | null;
  clearer: { three_letter_code: string } | null;
  snag: { number: string } | null;
  extensions: { id: string; extra_days: number; status: string; authority_reference: string; new_due_at: string | null }[];
};

export const DDLS_SELECT = `id, page_no, entry_no, kind, status, mel_ref, mel_category, manual_reference, days_allowed,
  interval_value, interval_unit,
  defect_text, m_required, o_required, remarks, tlb_book, tlb_page, tlb_item, deferred_at, due_at, limit_text,
  cleared_at, rectification, rect_tlb_book, rect_tlb_page, snag_id,
  deferrer:deferred_by (three_letter_code), clearer:cleared_by (three_letter_code), snag:snag_id (number),
  extensions:ddls_extension (id, extra_days, status, authority_reference, new_due_at)`;

// Time left on a calendar limit, as a plain subtraction of recorded times.
export function timeLeft(due: string | null, now: Date): { text: string; tone: string } | null {
  if (!due) return null;
  const ms = new Date(due).getTime() - now.getTime();
  if (ms < 0) return { text: 'Limit exceeded', tone: 'red' };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return { text: days > 0 ? `${days}d ${hours}h left` : `${hours}h left`, tone: 'plain' };
}

export function useTailParam(aircraft: AircraftOption[]) {
  const [params, setParams] = useSearchParams();
  const id = params.get('aircraft') || aircraft[0]?.id || '';
  const set = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set('aircraft', v); else next.delete('aircraft');
    setParams(next, { replace: true });
  };
  return [id, set] as const;
}

export function DdlsSheet() {
  const { me, display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [tailId, setTailId] = useTailParam(aircraft);
  const [showCleared, setShowCleared] = useState(false);
  const [entries, setEntries] = useState<DdlsEntry[] | null>(null);
  const [extCats, setExtCats] = useState<string[]>(['B', 'C', 'D']);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));
  const now = useMemo(() => new Date(), [entries]);
  const tail = aircraft.find((a) => a.id === tailId);

  const load = useCallback(async () => {
    if (!tailId) return;
    let q = db.from('ddls_entry').select(DDLS_SELECT).eq('aircraft_id', tailId).order('page_no').order('entry_no');
    if (!showCleared) q = q.eq('status', 'open');
    const { data } = await q;
    setEntries((data ?? []) as unknown as DdlsEntry[]);
  }, [tailId, showCleared]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    db.from('operator_setting_current').select('value').eq('key', 'ddls.extension_categories').maybeSingle()
      .then(({ data }) => { if (Array.isArray(data?.value)) setExtCats(data!.value as string[]); });
  }, []);

  const pages = useMemo(() => {
    const m = new Map<number, DdlsEntry[]>();
    (entries ?? []).forEach((e) => m.set(e.page_no, [...(m.get(e.page_no) ?? []), e]));
    return [...m.entries()];
  }, [entries]);

  const done = (msg: string) => { setMessage(msg); setOpen(null); load(); };

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">Home</Link> › Snags &amp; deferrals › DDLS</div>
      <div className="page-head">
        <div>
          <h1>Deferred Defects Log Sheet</h1>
          <div className="small muted">Airworthiness deferrals under control. NADDs are on their own sheet.</div>
        </div>
        <div className="row filter-row">
          <AircraftPicker aircraft={aircraft} value={tailId} onChange={setTailId} placeholder="Choose a tail" />
          <select aria-label="Which entries" value={showCleared ? 'all' : 'open'} onChange={(e) => setShowCleared(e.target.value === 'all')}>
            <option value="open">Show: Open entries</option>
            <option value="all">Show: All, including cleared</option>
          </select>
          {tailId && <Link className="button secondary" to={`/print/ddls/${tailId}`} target="_blank">Print DDLS</Link>}
        </div>
      </div>
      {message && <div className="success" role="status">{message}</div>}
      {entries && entries.length === 0 && (
        <div className="card"><p className="muted">No {showCleared ? '' : 'open '}DDLS entries on {tail?.tail ?? 'this tail'}.</p></div>
      )}
      {pages.map(([page, list]) => {
        const closed = list.every((e) => e.status === 'cleared');
        return (
          <section key={page} className="card sheet">
            <h2>
              <span className="mono">{tail?.tail}</span> · DDLS page {page}
              {closed && <span className="chip tone-grey" style={{ marginLeft: 8 }}>Page closed</span>}
            </h2>
            <table className="board sheet-table">
              <thead>
                <tr>
                  <th aria-label="Actions" style={{ width: 44 }} />
                  <th>Entry</th><th>TLB ref</th><th>MEL / reference</th><th>Defect</th>
                  <th>(M) (O)</th><th>Deferred</th><th>Limit</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const left = e.status === 'open' ? timeLeft(e.due_at, now) : null;
                  const pending = e.extensions.find((x) => x.status === 'pending');
                  const canExtend = e.status === 'open' && e.due_at && !pending
                    && (e.kind !== 'mel' || extCats.includes(e.mel_category ?? ''));
                  return (
                    <Fragment key={e.id}>
                      <tr className={e.status === 'cleared' ? 'cleared' : ''}>
                        <td>
                          {isEngineer && e.status === 'open' && (
                            <button type="button" className="expand" aria-expanded={open === e.id}
                              aria-label={`Actions for entry ${e.entry_no}`} onClick={() => setOpen((o) => (o === e.id ? null : e.id))}>
                              <span aria-hidden>▸</span>
                            </button>
                          )}
                        </td>
                        <td className="mono">{e.page_no}/{e.entry_no}
                          {e.snag && <div className="small"><Link to={`/snags/${e.snag_id}`}>{e.snag.number}</Link></div>}</td>
                        <td className="mono small">{[e.tlb_book, e.tlb_page, e.tlb_item].filter(Boolean).join(' / ') || '—'}</td>
                        <td>{e.kind === 'mel'
                          ? <><span className="mono">{e.mel_ref}</span> <span className="chip tone-grey">Cat {e.mel_category}</span></>
                          : <span className="small">Non-MEL · {e.manual_reference}</span>}</td>
                        <td>{e.defect_text}{e.remarks && <div className="small muted">{e.remarks}</div>}</td>
                        <td className="small">{e.m_required ? '(M)' : 'N/A'} {e.o_required ? '(O)' : 'N/A'}</td>
                        <td className="small"><span className="mono">{e.deferrer?.three_letter_code}</span> · {formatDateTime(e.deferred_at, display)}</td>
                        <td className="small">
                          {e.status === 'cleared' ? (
                            <span className="chip tone-grey">Cleared · {e.clearer?.three_letter_code} · {formatDateTime(e.cleared_at, display)}</span>
                          ) : (
                            <>
                              {e.due_at ? <div>Due {formatDateTime(e.due_at, display)}</div> : <div>{e.limit_text}</div>}
                              {left && <span className={left.tone === 'red' ? 'chip tone-red' : 'muted'}>{left.text}</span>}
                              {pending && <div><span className="chip tone-amber">Extension +{pending.extra_days}d requested</span></div>}
                            </>
                          )}
                        </td>
                      </tr>
                      {open === e.id && (
                        <tr className="expanded-row">
                          <td />
                          <td colSpan={7}>
                            <div className="detail-grid">
                              <ClearForm entry={e} onDone={done} />
                              {canExtend
                                ? <ExtendForm entry={e} onDone={done} />
                                : <div className="small muted">
                                    {pending ? 'An extension is already waiting for approval.'
                                      : !e.due_at ? 'Only calendar-day limits can be extended here.'
                                      : `MEL category ${e.mel_category} items cannot be extended (D-163).`}
                                  </div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function ClearForm({ entry, onDone }: { entry: DdlsEntry; onDone: (m: string) => void }) {
  const [text, setText] = useState('');
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    if (!text.trim()) return setError('Describe the rectification actions.');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN (4 to 8 digits) to sign.');
    setBusy(true);
    const { error: err } = await actions.rpc('clear_ddls_entry', {
      p_entry: entry.id, p_rectification: text.trim(), p_pin: pin,
      p_rect_tlb_book: book || undefined, p_rect_tlb_page: page || undefined,
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone(`DDLS page ${entry.page_no} entry ${entry.entry_no} cleared; ${entry.snag?.number ?? 'the snag'} closed. The tail status is unchanged until an engineer sets it (D-046).`);
  }
  return (
    <form onSubmit={submit}>
      <h3>Clear entry {entry.page_no}/{entry.entry_no}</h3>
      <label htmlFor={`rect-${entry.id}`}>Rectification actions</label>
      <textarea id={`rect-${entry.id}`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <div><label htmlFor={`rb-${entry.id}`}>Rectification TLB book</label>
          <input id={`rb-${entry.id}`} className="mono" value={book} onChange={(e) => setBook(e.target.value)} /></div>
        <div><label htmlFor={`rp-${entry.id}`}>Page</label>
          <input id={`rp-${entry.id}`} className="mono" value={page} onChange={(e) => setPage(e.target.value)} /></div>
      </div>
      <PinField id={`pin-${entry.id}`} value={pin} onChange={setPin} />
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Signing…' : 'Sign and clear'}</button></p>
    </form>
  );
}

function ExtendForm({ entry, onDone }: { entry: DdlsEntry; onDone: (m: string) => void }) {
  const [days, setDays] = useState('');
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    if (!/^[0-9]+$/.test(days) || Number(days) < 1) return setError('Enter the extra days (a whole number).');
    if (!ref.trim()) return setError('Give the authority reference for the extension.');
    if (!reason.trim()) return setError('Give the reason.');
    setBusy(true);
    const { error: err } = await actions.rpc('request_ddls_extension', {
      p_entry: entry.id, p_extra_days: Number(days), p_authority_reference: ref.trim(), p_reason: reason.trim(),
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone(`Extension of ${days} days requested for entry ${entry.page_no}/${entry.entry_no}. It goes to the approver; the limit is unchanged until approved (D-056).`);
  }
  return (
    <form onSubmit={submit}>
      <h3>Request an extension</h3>
      <div className="row">
        <div><label htmlFor={`xd-${entry.id}`}>Extra days</label>
          <input id={`xd-${entry.id}`} className="mono" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} /></div>
        <div><label htmlFor={`xr-${entry.id}`}>Authority reference</label>
          <input id={`xr-${entry.id}`} className="mono" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
      </div>
      <label htmlFor={`xn-${entry.id}`}>Reason</label>
      <textarea id={`xn-${entry.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Request extension'}</button></p>
    </form>
  );
}
