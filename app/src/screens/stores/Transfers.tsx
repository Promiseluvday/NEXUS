// Transfers between the Main Store and the Forward Store (WF-TR1).
//
//   ✓ Raised → ● In transit → ○ Received by Forward → ○ Acknowledged by Main
//
// D-142: the Main Store is the store of record. Stock leaves the sending
//   store when the transfer is raised; it counts in the Forward Store only
//   once the Main Store acknowledges the receipt.
// D-151: returns Forward → Main use the same transfer record, reversed, and
//   name the transfer they reverse. A return is complete when Main receives it.
// Store access decides who sees which button: Forward users "Confirm
// receipt", Main users "Acknowledge" (D-152).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, errorText } from '../../lib/supabase';
import { formatDateTime } from '../../lib/format';
import { BackButton, Crumbs, PageHead, Section } from '../../components/PageFrame';
import { Empty, StoresTabs, qtyText, useMyStores, useSupplyRights } from './common';
import type { SearchRow } from './Search';

type Transfer = {
  id: string; number: string; from_store: string; to_store: string; qty: number; status: string; note: string | null;
  raised_at: string; received_at: string | null; acknowledged_at: string | null; return_of: string | null;
  part_id: string; part: { part_number: string; description: string } | null;
  raiser: { three_letter_code: string } | null; receiver: { three_letter_code: string } | null;
  acknowledger: { three_letter_code: string } | null;
  original: { number: string } | null;
};

function Steps({ t, record }: { t: Transfer; record: string | undefined }) {
  const intoRecord = t.to_store === record;
  const names = intoRecord
    ? ['Raised', 'In transit', `Received by ${t.to_store}`]
    : ['Raised', 'In transit', `Received by ${t.to_store}`, `Acknowledged by ${record ?? 'Main'}`];
  const at = { in_transit: 1, received: 2, acknowledged: names.length }[t.status] ?? 0;
  return (
    <ol className="wo-steps" aria-label="Transfer steps">
      {names.map((n, i) => {
        const s = i < at || (i === 0) ? 'done' : i === at ? 'now' : 'todo';
        return <li key={n} className={`wo-step ${s}`}><span aria-hidden>{({ done: '✓', now: '●', todo: '○' } as Record<string, string>)[s]}</span> {n}</li>;
      })}
    </ol>
  );
}

export function Transfers() {
  const { display } = useAuth();
  const { stores, held } = useMyStores();
  const { canIssue, canReceive } = useSupplyRights();
  const record = stores.find((s) => s.is_store_of_record)?.code;
  const [rows, setRows] = useState<Transfer[] | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Raise form
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [partText, setPartText] = useState('');
  const [matches, setMatches] = useState<SearchRow[]>([]);
  const [part, setPart] = useState<SearchRow | null>(null);
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [returnOf, setReturnOf] = useState('');

  useEffect(() => {
    if (!from && held.length) setFrom(held.includes(record ?? '') ? record! : held[0]);
  }, [held, record, from]);
  useEffect(() => {
    // One end is always the store of record (D-142).
    if (!from || !stores.length) return;
    if (from === record) setTo(stores.find((s) => s.code !== record)?.code ?? '');
    else setTo(record ?? '');
  }, [from, record, stores]);

  const load = useCallback(async () => {
    let q = anyDb.from('stock_transfer')
      .select(`id, number, from_store, to_store, qty, status, note, raised_at, received_at, acknowledged_at, return_of, part_id,
               part:part_id (part_number, description), raiser:raised_by (three_letter_code),
               receiver:received_by (three_letter_code), acknowledger:acknowledged_by (three_letter_code),
               original:return_of (number)`)
      .order('raised_at', { ascending: false }).limit(100);
    if (!showDone) q = q.neq('status', 'acknowledged');
    const { data, error: err } = await q;
    if (err) setError(errorText(err));
    setRows((data ?? []) as Transfer[]);
  }, [showDone]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (part || partText.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(() => anyActions.rpc('search_stores', { p_text: partText.trim(), p_limit: 8 })
      .then(({ data }: { data: SearchRow[] | null }) => setMatches(data ?? [])), 250);
    return () => clearTimeout(t);
  }, [partText, part]);

  // Completed transfers into this store that a return could reverse (D-151).
  const [reversible, setReversible] = useState<Transfer[]>([]);
  useEffect(() => {
    if (!part || from === record) { setReversible([]); return; }
    anyDb.from('stock_transfer').select('id, number, raised_at, qty').eq('status', 'acknowledged')
      .eq('part_id', part.part_id).eq('to_store', from).eq('from_store', to).order('raised_at', { ascending: false }).limit(20)
      .then(({ data }: { data: Transfer[] | null }) => setReversible(data ?? []));
  }, [part, from, to, record]);

  async function raise(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!part) return setError('Choose the part.');
    const { error: err } = await anyActions.rpc('raise_transfer', {
      p_part: part.part_id, p_from: from, p_to: to, p_qty: Number(qty), p_lot: null,
      p_return_of: returnOf || null, p_note: note || null,
    });
    if (err) return setError(errorText(err));
    setMessage(`Transfer raised: ${qtyText(qty)} × ${part.part_number}, ${from} → ${to}, in transit`);
    setPart(null); setPartText(''); setQty('1'); setNote(''); setReturnOf('');
    load();
  }
  async function act(fn: string, t: Transfer, done: string) {
    setError('');
    const { error: err } = await anyActions.rpc(fn, { p_transfer: t.id });
    if (err) return setError(errorText(err));
    setMessage(`${t.number}: ${done}`);
    load();
  }

  const fromAvail = part?.stores.find((s) => s.store === from)?.available;
  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Stores search', to: '/stores' }, { label: 'Transfers' }]} />
      <BackButton to="/stores/issue" label="Issue parts" />
      <StoresTabs />
      <PageHead title="Transfers" sub="Main Store to Forward Store, and returns Forward → Main (D-142, D-151)" />
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      {canIssue && held.length > 0 && (
        <Section title={from === record ? 'Raise transfer (Main Store)' : 'Return to the Main Store'}>
          <form className="st-form" onSubmit={raise}>
            <div className="row st-row">
              <div>
                <label htmlFor="tr-from">From</label>
                <select id="tr-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {stores.filter((s) => held.includes(s.code)).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="tr-to">To</label>
                <select id="tr-to" value={to} onChange={(e) => setTo(e.target.value)}>
                  {stores.filter((s) => s.code !== from && (from === record || s.code === record)).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </div>
            </div>
            {part ? (
              <div className="mel-chosen">
                <span className="mono">{part.part_number}</span> · {part.description}
                {fromAvail !== undefined && <span className="small"> · {qtyText(fromAvail)} available in {from}</span>}
                <button type="button" className="link-button" onClick={() => setPart(null)}>Change</button>
              </div>
            ) : (
              <>
                <label htmlFor="tr-part">Part</label>
                <input id="tr-part" value={partText} onChange={(e) => setPartText(e.target.value)} autoComplete="off" placeholder="Part number or description" />
                {matches.length > 0 && (
                  <ul className="pick-list">
                    {matches.map((m) => (
                      <li key={m.part_id}><button type="button" onClick={() => setPart(m)}>
                        <span className="mono">{m.part_number}</span><span>{m.description}</span>
                        <span className="small">{m.stores.map((s) => `${s.store} ${qtyText(s.available)}`).join(' · ')}</span>
                      </button></li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <div className="row st-row">
              <div><label htmlFor="tr-qty">Quantity</label>
                <input id="tr-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))} /></div>
              <div><label htmlFor="tr-note">Note</label><input id="tr-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            {from !== record && (
              <>
                <label htmlFor="tr-ret">Reverses transfer (optional, D-151)</label>
                <select id="tr-ret" value={returnOf} onChange={(e) => setReturnOf(e.target.value)}>
                  <option value="">Not linked</option>
                  {reversible.map((t) => <option key={t.id} value={t.id}>{t.number} · {qtyText(t.qty)} · {formatDateTime(t.raised_at, display)}</option>)}
                </select>
              </>
            )}
            <div className="action-row"><button type="submit">Raise transfer</button></div>
            <p className="small muted">Only serviceable, certified, in-date and unreserved stock moves; one batch at a time.</p>
          </form>
        </Section>
      )}

      <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed transfers</label>
      {rows === null && <p className="muted">Loading…</p>}
      {rows?.length === 0 && <div className="box"><div className="box-body"><Empty>No transfers in progress.</Empty></div></div>}
      {rows && rows.length > 0 && (
        <ul className="st-cards">
          {rows.map((t) => {
            const canConfirm = canReceive || canIssue;
            const confirm = t.status === 'in_transit' && held.includes(t.to_store) && canConfirm;
            const ack = t.status === 'received' && record !== undefined && held.includes(record) && canConfirm;
            const next = t.status === 'in_transit' ? `${t.to_store}: confirm receipt` : t.status === 'received' ? `${record ?? 'Main'}: acknowledge` : 'Complete';
            return (
              <li key={t.id} className="box">
                <div className="box-body">
                  <div className="st-lot-top">
                    <span className="mono">{t.number}</span>
                    <strong>{t.part?.description}</strong> <span className="mono small">{t.part?.part_number}</span>
                    <span className="mono">{qtyText(t.qty)}</span>
                    <span className="dept-tag">{t.from_store} → {t.to_store}</span>
                    {t.original && <span className="small muted">return of <span className="mono">{t.original.number}</span></span>}
                  </div>
                  <Steps t={t} record={record} />
                  <div className="small muted">
                    Raised by <span className="mono">{t.raiser?.three_letter_code}</span> · {formatDateTime(t.raised_at, display)}
                    {t.received_at && <> · received by <span className="mono">{t.receiver?.three_letter_code}</span> · {formatDateTime(t.received_at, display)}</>}
                    {t.acknowledged_at && <> · acknowledged by <span className="mono">{t.acknowledger?.three_letter_code}</span></>}
                    {t.note && <> · {t.note}</>}
                  </div>
                  <div className="action-row">
                    <span className="small"><strong>Next step:</strong> {next}</span>
                    {confirm && <button type="button" onClick={() => act('receive_transfer', t, 'receipt confirmed')}>Confirm receipt</button>}
                    {ack && <button type="button" onClick={() => act('acknowledge_transfer', t, 'acknowledged; now in stock')}>Acknowledge</button>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
