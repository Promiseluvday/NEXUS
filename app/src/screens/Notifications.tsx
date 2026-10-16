// Notifications (layout WF-M1).
//
// There is no notifications table yet, so this screen is built from the
// records that already exist, read-only, each linking to its record:
//   Approvals        waiting for your PIN (the same list as the approvals inbox)
//   Queries          technical queries waiting on you: sent to your department
//                    (or you) by someone else, or raised by you with a newer
//                    note from someone else (an answer you may close on)
//   Send queue       your items on this device that the server refused
//   Due soon         DDLS deferrals and NADDs whose recorded due time is within
//                    the operator's margin (attention.approaching_days) or past
//   Rectified        (stored notices, migration 0034) a snag's rectification
//                    was certified: Quality and the CO each acknowledge it.
//                    Acknowledging records who and when; it approves nothing.
// Nothing is worked out by Nexus: "due in 1 day" is the recorded due time
// minus now (D-020, D-021).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText, hideRefs } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { useOutbox } from '../lib/offline/hooks';
import { useApproachingDays } from '../lib/settings';
import { formatDateTime, formatPlainDate, heldFor } from '../lib/format';
import { dueText } from '../components/NeedsAttention';
import { QUERY_SELECT, deptName, type QueryRow } from '../components/Queries';
import { BackButton, Crumbs, PageHead, Section } from '../components/PageFrame';
import { usePendingApprovals } from './Approvals';

const DAY = 86_400_000;

// ------------------------------------------------ rectified notices
export type NoticeStep = { step_no: number; name: string; acknowledged_by: string | null; acknowledged_at: string | null; note: string | null };
type Notice = {
  id: string; kind: string; aircraft_id: string; tail: string; record_table: string; record_id: string;
  title: string; body: string; created_at: string; waiting_for_me: boolean; steps: NoticeStep[];
};

// The bell's share: notices waiting for my acknowledgement. Refreshed every
// minute and when a notice is acknowledged ("nexus:notices").
export function useNoticeCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const load = () => actions.rpc('my_unacknowledged_count').then(({ data }) => setN(typeof data === 'number' ? data : 0));
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener('nexus:notices', load);
    return () => { clearInterval(t); window.removeEventListener('nexus:notices', load); };
  }, []);
  return n;
}

// The bell's share for case chat: unread messages in threads I follow.
export function useMessageCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const load = () => actions.rpc('my_unread_messages').then(({ data }) => setN(typeof data === 'number' ? data : 0));
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener('nexus:messages', load);
    return () => { clearInterval(t); window.removeEventListener('nexus:messages', load); };
  }, []);
  return n;
}

type Thread = { record_table: string; record_id: string; aircraft_id: string; title: string; unread: number;
  last_body: string; last_author: string; last_at: string };

function useThreads() {
  const [rows, setRows] = useState<Thread[] | null>(null);
  useEffect(() => {
    actions.rpc('my_case_threads').then(({ data }) => setRows((data ?? []) as unknown as Thread[]));
  }, []);
  return rows;
}

const recordLink = (n: { record_table: string; record_id: string; aircraft_id: string }) =>
  n.record_table === 'work_order' ? `/work-orders/${n.record_id}` : `/nadds?aircraft=${n.aircraft_id}`;

// Who has acknowledged, step by step: "Quality ✓ QAR 12 Oct 09:14 · CO waiting".
export function NoticeSteps({ steps }: { steps: NoticeStep[] }) {
  const { display } = useAuth();
  return (
    <span className="nt-steps">
      {steps.map((s) => (
        <span key={s.step_no} className={`chip tone-${s.acknowledged_by ? 'green' : 'amber'}`}>
          {s.name.replace(/ (pre-|final )?approval$/i, '')}{' '}
          {s.acknowledged_by
            ? <>✓ <span className="mono">{s.acknowledged_by}</span> · {formatDateTime(s.acknowledged_at, display)}</>
            : 'to acknowledge'}
        </span>
      ))}
    </span>
  );
}

function RectifiedNotices() {
  const { display } = useAuth();
  const [rows, setRows] = useState<Notice[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => {
    actions.rpc('my_notices', { p_done_limit: 10 }).then(({ data }) => setRows((data ?? []) as unknown as Notice[]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function acknowledge(id: string) {
    setBusy(id); setError('');
    const { error: err } = await actions.rpc('acknowledge_notice', { p_notification: id, p_note: notes[id]?.trim() || undefined });
    setBusy('');
    if (err) return setError(errorText(err));
    window.dispatchEvent(new Event('nexus:notices'));
    load();
  }

  if (rows === null) return null;
  const waiting = rows.filter((r) => r.waiting_for_me);
  const done = rows.filter((r) => !r.waiting_for_me);
  if (!rows.length) return null;   // only Quality and the CO receive these

  const item = (n: Notice) => (
    <li key={n.id} className="nt-notice">
      <div className="nt-item nt-item-static">
        <span className={`chip tone-${n.waiting_for_me ? 'amber' : 'green'}`}>Rectified</span>
        <span className="nt-text"><Link to={recordLink(n)}>{n.title}</Link></span>
        <span className="nt-meta">{n.body} · {formatDateTime(n.created_at, display)}</span>
        <NoticeSteps steps={n.steps} />
        {n.waiting_for_me && (
          <span className="nt-ack">
            <input aria-label="Note (optional)" placeholder="Note (optional)" value={notes[n.id] ?? ''}
              onChange={(e) => setNotes((m) => ({ ...m, [n.id]: e.target.value }))} />
            <button type="button" disabled={busy === n.id} onClick={() => acknowledge(n.id)}>
              {busy === n.id ? 'Saving…' : 'Acknowledge'}
            </button>
          </span>
        )}
      </div>
    </li>
  );

  return (
    <>
      <Section title={`Rectified, to acknowledge (${waiting.length})`} tone={waiting.length ? 'strong' : undefined}>
        {error && <div className="error" role="alert">{error}</div>}
        {waiting.length === 0
          ? <p className="small muted nt-empty">Nothing waiting for your acknowledgement.</p>
          : <ul className="nt-list">{waiting.map(item)}</ul>}
        <p className="panel-note">
          Sent when a snag's rectification is certified. Acknowledging records that you have seen it, with your name and
          the time; the certifying engineer's signature is the release.
        </p>
      </Section>
      {done.length > 0 && (
        <Section title={`Rectified, acknowledged (latest ${done.length})`}>
          <ul className="nt-list">{done.map(item)}</ul>
        </Section>
      )}
    </>
  );
}

type Item = { key: string; to: string; text: ReactNode; meta: ReactNode; at: number; tone?: string; tag?: string };

type DdlsDue = { id: string; aircraft_id: string; kind: string; mel_category: string | null; due_at: string; aircraft: { tail: string } | null };
type NaddDue = { id: string; number: string; aircraft_id: string; due_at: string; aircraft: { tail: string } | null };

// Due DDLS and NADD items: the same rule as the dashboard's Needs attention
// panel (open, recorded due time within the margin or past).
function useDueSoon(margin: number) {
  const [ddls, setDdls] = useState<DdlsDue[] | null>(null);
  const [nadds, setNadds] = useState<NaddDue[] | null>(null);
  useEffect(() => {
    const soon = new Date(Date.now() + margin * DAY).toISOString();
    // Same cache key as Needs attention, so offline both show the same list.
    cached('attention_ddls', () => db.from('ddls_entry')
      .select('id, aircraft_id, kind, mel_category, due_at, aircraft:aircraft_id (tail)')
      .eq('status', 'open').not('due_at', 'is', null).lte('due_at', soon).order('due_at'))
      .then((r) => setDdls((r.data ?? []) as unknown as DdlsDue[]));
    cached('notify_nadds', () => db.from('nadd')
      .select('id, number, aircraft_id, due_at, aircraft:aircraft_id (tail)')
      .eq('status', 'open').not('due_at', 'is', null).lte('due_at', soon).order('due_at'))
      .then((r) => setNadds((r.data ?? []) as unknown as NaddDue[]));
  }, [margin]);
  return { ddls, nadds };
}

function useMyQueries() {
  const [rows, setRows] = useState<QueryRow[] | null>(null);
  useEffect(() => {
    db.from('technical_query').select(QUERY_SELECT).eq('status', 'open').order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as QueryRow[]));
  }, []);
  return rows;
}

export function Notifications() {
  const { me, display } = useAuth();
  const now = useMemo(() => new Date(), []);
  const margin = useApproachingDays();
  const { items: approvals } = usePendingApprovals();
  const queries = useMyQueries();
  const outbox = useOutbox();
  const { ddls, nadds } = useDueSoon(margin);
  const notices = useNoticeCount();   // rectified notices waiting for my acknowledgement
  const threads = useThreads();       // case chat with new messages

  // ---- approvals waiting for your PIN
  const approvalItems: Item[] = (approvals ?? []).map((p) => ({
    key: p.id,
    to: p.record_table === 'work_order' ? `/work-orders/${p.record_id}` : '/approvals',
    text: <>{p.summary} · waiting for your approval</>,
    meta: <>{p.chain_name} · step {p.step_no}: {p.step_name} · raised by <span className="mono">{p.raised_by}</span> · waiting {heldFor(p.waiting_since, now)}</>,
    at: new Date(p.waiting_since).getTime(), tag: 'Approval',
  }));

  // ---- technical queries waiting on you
  const myDepts = new Set(me?.departments.map((d) => d.code) ?? []);
  const queryItems: Item[] = [];
  for (const q of queries ?? []) {
    const notes = q.notes.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = notes[notes.length - 1];
    const due = q.due_on ? ` · due ${formatPlainDate(q.due_on, display)}` : '';
    if (q.raised_by === me?.personId) {
      // Raised by you: someone else wrote the latest note, so it may be answered.
      if (last && last.author !== me?.personId) {
        queryItems.push({
          key: q.id, to: `/queries?q=${q.id}`, at: new Date(last.created_at).getTime(), tag: 'Answered?',
          text: <><span className="mono">{q.number}</span> {q.subject} · new note from <span className="mono">{last.writer?.three_letter_code}</span></>,
          meta: <>You raised it · {formatDateTime(last.created_at, display)}</>,
        });
      }
    } else if (q.assigned_person === me?.personId || (q.assigned_department && myDepts.has(q.assigned_department))) {
      queryItems.push({
        key: q.id, to: `/queries?q=${q.id}`, at: new Date(last?.created_at ?? q.created_at).getTime(),
        tone: q.urgent ? 'red' : undefined, tag: q.urgent ? 'Urgent' : 'Query',
        text: <><span className="mono">{q.number}</span> {q.subject} · assigned to {q.assigned_person === me?.personId ? 'you' : `your group (${deptName(q.assigned_department)})`}{due}</>,
        meta: <>Raised by <span className="mono">{q.raiser?.three_letter_code}</span> · {formatDateTime(q.created_at, display)} · {q.notes.length} note{q.notes.length === 1 ? '' : 's'}</>,
      });
    }
  }

  // ---- send queue items the server refused (this device only)
  const refusedItems: Item[] = outbox.filter((i) => i.status === 'failed').map((i) => ({
    key: String(i.id), to: '/sync', at: i.createdAt, tone: 'red', tag: 'Refused',
    text: <>{i.label}</>,
    meta: <>{i.error ? hideRefs(i.error) : 'Refused by the server'} · made {formatDateTime(new Date(i.createdAt), display)}</>,
  }));

  // ---- DDLS and NADD items due soon (soonest first)
  const dueItems: Item[] = [
    ...(ddls ?? []).map((e) => ({
      key: e.id, to: `/ddls?aircraft=${e.aircraft_id}`, at: new Date(e.due_at).getTime(),
      tone: new Date(e.due_at) <= now ? 'red' : 'amber', tag: new Date(e.due_at) <= now ? 'Reached' : 'Approaching',
      text: <>{e.kind === 'mel' ? `MEL${e.mel_category ? ` Cat ${e.mel_category}` : ''} deferral` : 'DDLS deferral'} due {dueText(e.due_at, now)} · <span className="mono">{e.aircraft?.tail}</span></>,
      meta: <>Due {formatDateTime(e.due_at, display)} (written at deferral)</>,
    })),
    ...(nadds ?? []).map((n) => ({
      key: n.id, to: `/nadds?aircraft=${n.aircraft_id}`, at: new Date(n.due_at).getTime(),
      tone: new Date(n.due_at) <= now ? 'red' : 'amber', tag: new Date(n.due_at) <= now ? 'Reached' : 'Approaching',
      text: <>NADD <span className="mono">{n.number}</span> due {dueText(n.due_at, now)} · <span className="mono">{n.aircraft?.tail}</span></>,
      meta: <>Due {formatDateTime(n.due_at, display)} (written at deferral)</>,
    })),
  ].sort((a, b) => a.at - b.at);

  const newestFirst = (list: Item[]) => list.slice().sort((a, b) => b.at - a.at);
  const loading = approvals === null || queries === null || ddls === null || nadds === null;
  const messageItems: Item[] = (threads ?? []).map((t) => ({
    key: `${t.record_table}:${t.record_id}`,
    to: `${t.record_table === 'work_order' ? '/work-orders/' : t.record_table === 'snag' ? '/snags/' : '/nadds?aircraft='}${t.record_table === 'nadd' ? t.aircraft_id : t.record_id}#case-chat`,
    at: new Date(t.last_at).getTime(), tag: `${t.unread} new`,
    text: <>{t.title}</>,
    meta: <><span className="mono">{t.last_author}</span>: {t.last_body.slice(0, 120)} · {formatDateTime(t.last_at, display)}</>,
  }));
  const total = messageItems.length + notices + approvalItems.length + queryItems.length + refusedItems.length + dueItems.length;

  return (
    <div className="page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Notifications' }]} />
      <BackButton to="/" label="All aircraft" />
      <PageHead title="Notifications" sub={loading ? 'Loading…' : `${total} item${total === 1 ? ' needs' : 's need'} you`} />
      <p className="small muted nt-note">
        What is waiting for you right now. Rectified notices stay until acknowledged; the other items disappear when the
        record moves on.
      </p>

      <RectifiedNotices />

      {messageItems.length > 0 && <Group title="Case chat, new messages" items={messageItems} empty="" />}
      <Group title="Approvals waiting for you" items={newestFirst(approvalItems)} empty="No approvals waiting for you."
        more={approvalItems.length > 0 ? { to: '/approvals', label: 'Open approvals' } : undefined} />
      <Group title="Technical queries" items={newestFirst(queryItems)} empty="No queries waiting on you."
        more={{ to: '/queries', label: 'All queries' }} />
      {refusedItems.length > 0 && (
        <Group title="Refused on this device" items={newestFirst(refusedItems)} empty="" tone="warn"
          more={{ to: '/sync', label: 'Open sync queue' }} />
      )}
      <Group title={`Due soon (within ${margin} day${margin === 1 ? '' : 's'}, soonest first)`} items={dueItems}
        empty="No DDLS or NADD items due soon." />
    </div>
  );
}

function Group({ title, items, empty, more, tone }: {
  title: string; items: Item[]; empty: string; more?: { to: string; label: string }; tone?: 'warn';
}) {
  return (
    <Section title={`${title} (${items.length})`} tone={tone} actions={more && <Link className="small" to={more.to}>{more.label}</Link>}>
      {items.length === 0
        ? <p className="small muted nt-empty">{empty}</p>
        : (
          <ul className="nt-list">
            {items.map((i) => (
              <li key={i.key}>
                <Link to={i.to} className="nt-item">
                  {i.tag && <span className={`chip tone-${i.tone ?? 'blue'}`}>{i.tag}</span>}
                  <span className="nt-text">{i.text}</span>
                  <span className="nt-meta">{i.meta}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </Section>
  );
}
