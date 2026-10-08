// NADDs: Non-Airworthiness Deferred Defects (D-048, D-160 to D-166, D-209,
// workflows/nadd.md).
//
// Per tail: items waiting for an engineer (proposed by crew or engineers),
// open items with their countdown (from the REPORT date, D-160), and closed
// ones. NADDs never change the tail status and never block the A-check
// (D-165, D-166).
//
// Engineers pick one action from a dropdown (docs/ui-rules.md):
//   Proposed: confirm as NADD (declaration + PIN), reject with a reason the
//             reporter sees, or reclassify as a snag
//   Open:     rectify (PIN), request an extension (approval), reclassify
// Crews see the list, so they know what is inoperative in the cabin.
import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { PinField } from '../components/PinField';
import { timeLeft, useTailParam } from './Ddls';

export type Nadd = {
  id: string; number: string; status: string; zone_code: string | null; location: string | null;
  description: string; ata: string | null; reported_at: string; due_at: string | null; limit_days: number | null;
  tlb_book: string | null; tlb_page: string | null; tlb_item: string | null;
  rectified_at: string | null; action_taken: string | null; rect_tlb_book: string | null; rect_tlb_page: string | null;
  reject_reason: string | null; reclassified_snag_id: string | null; snag_id: string | null;
  reporter: { three_letter_code: string } | null;
  confirmer: { three_letter_code: string } | null;
  rectifier: { three_letter_code: string } | null;
  extensions: { id: string; extra_days: number; status: string }[];
};

export const NADD_SELECT = `id, number, status, zone_code, location, description, ata, reported_at, due_at, limit_days,
  tlb_book, tlb_page, tlb_item, rectified_at, action_taken, rect_tlb_book, rect_tlb_page, reject_reason,
  reclassified_snag_id, snag_id,
  reporter:reported_by (three_letter_code), confirmer:confirmed_by (three_letter_code),
  rectifier:rectified_by (three_letter_code), extensions:nadd_extension (id, extra_days, status)`;

const STATE: Record<string, { label: string; tone: string }> = {
  proposed: { label: 'Waiting for engineer', tone: 'blue' },
  open: { label: 'Open', tone: 'amber' },
  rectified: { label: 'Rectified', tone: 'grey' },
  reclassified: { label: 'Reclassified as snag', tone: 'grey' },
  rejected: { label: 'Rejected', tone: 'grey' },
};

const VIEWS: Record<string, string[]> = {
  current: ['proposed', 'open'],
  closed: ['rectified', 'reclassified', 'rejected'],
  all: ['proposed', 'open', 'rectified', 'reclassified', 'rejected'],
};

export function NaddList() {
  const { me, display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [tailId, setTailId] = useTailParam(aircraft);
  const [view, setView] = useState('current');
  const [rows, setRows] = useState<Nadd[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));
  const now = useMemo(() => new Date(), [rows]);
  const tail = aircraft.find((a) => a.id === tailId);

  const load = useCallback(async () => {
    if (!tailId) return;
    const { data } = await db.from('nadd').select(NADD_SELECT)
      .eq('aircraft_id', tailId).in('status', VIEWS[view]).order('reported_at');
    setRows((data ?? []) as unknown as Nadd[]);
  }, [tailId, view]);
  useEffect(() => { load(); }, [load]);

  const done = (m: string) => { setMessage(m); setOpen(null); load(); };

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">Home</Link> › Snags &amp; deferrals › NADDs</div>
      <div className="page-head">
        <div>
          <h1>Non-Airworthiness Deferred Defects</h1>
          <div className="small muted">Convenience items only. They never change the tail status (D-160).</div>
        </div>
        <div className="row filter-row">
          <AircraftPicker aircraft={aircraft} value={tailId} onChange={setTailId} placeholder="Choose a tail" />
          <select aria-label="Which NADDs" value={view} onChange={(e) => setView(e.target.value)}>
            <option value="current">Show: Waiting and open</option>
            <option value="closed">Show: Closed</option>
            <option value="all">Show: All</option>
          </select>
          {tailId && <Link className="button secondary" to={`/print/nadds/${tailId}`} target="_blank">Print NADDS</Link>}
        </div>
      </div>
      {message && <div className="success" role="status">{message}</div>}
      {rows?.length === 0 && <div className="card"><p className="muted">No NADDs to show on {tail?.tail ?? 'this tail'}.</p></div>}
      {rows && rows.length > 0 && (
        <table className="board sheet-table">
          <thead>
            <tr><th aria-label="Actions" style={{ width: 44 }} /><th>NADD</th><th>Where</th><th>Defect</th><th>Reported</th><th>State / limit</th></tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const s = STATE[n.status] ?? { label: n.status, tone: 'grey' };
              const left = n.status === 'open' ? timeLeft(n.due_at, now) : null;
              const pending = n.extensions.find((x) => x.status === 'pending');
              const actionable = isEngineer && (n.status === 'proposed' || n.status === 'open');
              return (
                <Fragment key={n.id}>
                  <tr>
                    <td>{actionable && (
                      <button type="button" className="expand" aria-expanded={open === n.id} aria-label={`Actions for ${n.number}`}
                        onClick={() => setOpen((o) => (o === n.id ? null : n.id))}><span aria-hidden>▸</span></button>
                    )}</td>
                    <td className="mono">{n.number}</td>
                    <td className="small">{[n.zone_code, n.location].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{n.description}
                      {n.reject_reason && <div className="small">Rejected: {n.reject_reason}</div>}
                      {n.action_taken && <div className="small">Action: {n.action_taken}</div>}
                      {n.reclassified_snag_id && <div className="small"><Link to={`/snags/${n.reclassified_snag_id}`}>Open the snag</Link></div>}
                    </td>
                    <td className="small"><span className="mono">{n.reporter?.three_letter_code}</span> · {formatDateTime(n.reported_at, display)}</td>
                    <td className="small">
                      <span className={`chip tone-${s.tone}`}>{s.label}</span>
                      {n.status === 'open' && n.due_at && <div>Due {formatDateTime(n.due_at, display)}</div>}
                      {left && <span className={left.tone === 'red' ? 'chip tone-red' : 'muted'}>{left.text}</span>}
                      {pending && <div><span className="chip tone-amber">Extension +{pending.extra_days}d requested</span></div>}
                    </td>
                  </tr>
                  {open === n.id && (
                    <tr className="expanded-row"><td /><td colSpan={5}>
                      <NaddActions nadd={n} hasPendingExtension={Boolean(pending)} onDone={done} />
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

type Action = 'confirm' | 'reject' | 'reclassify' | 'rectify' | 'extend';

function NaddActions({ nadd, hasPendingExtension, onDone }: { nadd: Nadd; hasPendingExtension: boolean; onDone: (m: string) => void }) {
  const choices: { key: Action; label: string }[] = nadd.status === 'proposed'
    ? [{ key: 'confirm', label: 'Confirm as NADD (sign)' }, { key: 'reject', label: 'Reject, with a reason' },
       { key: 'reclassify', label: 'Reclassify as a snag' }]
    : [{ key: 'rectify', label: 'Rectify (sign)' },
       ...(hasPendingExtension ? [] : [{ key: 'extend' as Action, label: 'Request an extension' }]),
       { key: 'reclassify', label: 'Reclassify as a snag' }];
  const [action, setAction] = useState<Action | ''>('');
  return (
    <div>
      <label htmlFor={`act-${nadd.id}`}>Action on {nadd.number}</label>
      <select id={`act-${nadd.id}`} value={action} onChange={(e) => setAction(e.target.value as Action)}>
        <option value="">Choose…</option>
        {choices.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      {action === 'confirm' && <ConfirmForm nadd={nadd} onDone={onDone} />}
      {action === 'reject' && <RejectForm nadd={nadd} onDone={onDone} />}
      {action === 'reclassify' && <ReclassifyForm nadd={nadd} />}
      {action === 'rectify' && <RectifyForm nadd={nadd} onDone={onDone} />}
      {action === 'extend' && <ExtendForm nadd={nadd} onDone={onDone} />}
    </div>
  );
}

function useAction(onDone: (m: string) => void) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(problem: string | null, call: () => PromiseLike<{ error: { message?: string } | null }>, message: string) {
    setError('');
    if (problem) return setError(problem);
    setBusy(true);
    const { error: err } = await call();
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone(message);
  }
  return { error, busy, run };
}

function Foot({ error, busy, label }: { error: string; busy: boolean; label: string }) {
  return (
    <>
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Sending…' : label}</button></p>
    </>
  );
}

function Labelled({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return <><label htmlFor={id}>{label}</label>{children}</>;
}

const pinProblem = (pin: string) => (/^[0-9]{4,8}$/.test(pin) ? null : 'Enter your PIN (4 to 8 digits) to sign.');

function ConfirmForm({ nadd, onDone }: { nadd: Nadd; onDone: (m: string) => void }) {
  const [limit, setLimit] = useState('');
  const [declared, setDeclared] = useState(false);
  const [pin, setPin] = useState('');
  const { error, busy, run } = useAction(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(!declared ? 'Confirm the item is not covered by the MEL and has no airworthiness effect (D-160).' : pinProblem(pin),
      () => actions.rpc('confirm_nadd', { p_nadd: nadd.id, p_pin: pin, p_declaration: declared, p_limit_days: limit ? Number(limit) : undefined }),
      `${nadd.number} confirmed. Its countdown runs from the report date (D-160).`);
  }
  return (
    <form onSubmit={submit}>
      <Labelled id={`lim-${nadd.id}`} label={<>Limit in days <span className="hint">(blank for the operator default; shorter only)</span></>}>
        <input id={`lim-${nadd.id}`} className="mono" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ''))} />
      </Labelled>
      <label className="check"><input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
        <span>I confirm this item is not covered by the MEL and has no effect on airworthiness (D-160).</span></label>
      <PinField id={`pin-${nadd.id}`} value={pin} onChange={setPin} />
      <Foot error={error} busy={busy} label="Sign and confirm" />
    </form>
  );
}

function RejectForm({ nadd, onDone }: { nadd: Nadd; onDone: (m: string) => void }) {
  const [reason, setReason] = useState('');
  const { error, busy, run } = useAction(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(reason.trim() ? null : 'Give a reason the reporter will see (D-209).',
      () => actions.rpc('reject_nadd', { p_nadd: nadd.id, p_reason: reason.trim() }),
      `${nadd.number} rejected. The reporter sees your reason.`);
  }
  return (
    <form onSubmit={submit}>
      <Labelled id={`rej-${nadd.id}`} label="Reason (the reporter sees this)">
        <textarea id={`rej-${nadd.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Labelled>
      <Foot error={error} busy={busy} label="Reject" />
    </form>
  );
}

function ReclassifyForm({ nadd }: { nadd: Nadd }) {
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error: err } = await actions.rpc('reclassify_nadd_as_snag', { p_nadd: nadd.id, p_note: note.trim() });
    setBusy(false);
    if (err) return setError(errorText(err));
    navigate(`/snags/${data as string}`);
  }
  return (
    <form onSubmit={submit}>
      <p className="small muted">A snag is raised, already attended by you, and follows the full snag workflow. The NADD stays on record as reclassified.</p>
      <Labelled id={`rc-${nadd.id}`} label="Why it is not a NADD">
        <textarea id={`rc-${nadd.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
      </Labelled>
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Reclassify as snag'}</button></p>
    </form>
  );
}

function RectifyForm({ nadd, onDone }: { nadd: Nadd; onDone: (m: string) => void }) {
  const [text, setText] = useState('');
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [pin, setPin] = useState('');
  const { error, busy, run } = useAction(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(!text.trim() ? 'Describe the action taken.' : pinProblem(pin),
      () => actions.rpc('rectify_nadd', { p_nadd: nadd.id, p_action_taken: text.trim(), p_pin: pin,
        p_rect_tlb_book: book || undefined, p_rect_tlb_page: page || undefined }),
      `${nadd.number} rectified.`);
  }
  return (
    <form onSubmit={submit}>
      <Labelled id={`at-${nadd.id}`} label="Action taken"><textarea id={`at-${nadd.id}`} value={text} onChange={(e) => setText(e.target.value)} /></Labelled>
      <div className="row">
        <div><Labelled id={`rb-${nadd.id}`} label="Log ref: book"><input id={`rb-${nadd.id}`} className="mono" value={book} onChange={(e) => setBook(e.target.value)} /></Labelled></div>
        <div><Labelled id={`rp-${nadd.id}`} label="Page"><input id={`rp-${nadd.id}`} className="mono" value={page} onChange={(e) => setPage(e.target.value)} /></Labelled></div>
      </div>
      <PinField id={`rpin-${nadd.id}`} value={pin} onChange={setPin} />
      <Foot error={error} busy={busy} label="Sign and rectify" />
    </form>
  );
}

function ExtendForm({ nadd, onDone }: { nadd: Nadd; onDone: (m: string) => void }) {
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const { error, busy, run } = useAction(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(!/^[0-9]+$/.test(days) || Number(days) < 1 ? 'Enter the extra days.' : reason.trim() ? null : 'Give the reason.',
      () => actions.rpc('request_nadd_extension', { p_nadd: nadd.id, p_extra_days: Number(days), p_reason: reason.trim() }),
      `Extension of ${days} days requested for ${nadd.number}; the limit is unchanged until approved.`);
  }
  return (
    <form onSubmit={submit}>
      <Labelled id={`xd-${nadd.id}`} label="Extra days"><input id={`xd-${nadd.id}`} className="mono" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} /></Labelled>
      <Labelled id={`xr-${nadd.id}`} label="Reason"><textarea id={`xr-${nadd.id}`} value={reason} onChange={(e) => setReason(e.target.value)} /></Labelled>
      <Foot error={error} busy={busy} label="Request extension" />
    </form>
  );
}
