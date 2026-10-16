// "In hand" and case chat (migration 0037; Promise, 14 and 16 Oct).
//
// useCaseHold  opening a snag or work order to work on it puts it "in hand"
//              for this engineer, refreshed every 2 minutes while the page is
//              open and released when they leave. If someone from the same
//              department already has it in hand, this returns who and since
//              when, and the page locks its actions (read-only).
// CaseHoldBanner  says who has it in hand, offers "Message", and lets a
//              Super Admin or Command release it with a reason.
// CaseChat     the case's message thread (a snag and its work order share
//              one). Messages are never edited. Opening it marks it read.
//
// A hold only says who is working on the case; it changes nothing about the
// aircraft. Offline, no hold is taken and nothing is locked.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { actions, errorText } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import { isOnline } from '../lib/offline/net';
import { Section } from './PageFrame';

export type CaseHold = { mine: boolean; held_by?: string; held_by_name?: string; since?: string };
type CaseTable = 'snag' | 'work_order';

export function useCaseHold(table: CaseTable, id: string | undefined) {
  const [hold, setHold] = useState<CaseHold | null>(null);
  const take = useCallback(async () => {
    if (!id || !isOnline()) return;
    const { data, error } = await actions.rpc('take_case', { p_table: table, p_id: id });
    if (!error) setHold(data as CaseHold);
  }, [table, id]);

  useEffect(() => {
    if (!id) return;
    void take();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void take(); }, 120_000);
    const back = () => { if (document.visibilityState === 'visible') void take(); };
    document.addEventListener('visibilitychange', back);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', back);
      if (isOnline()) void actions.rpc('release_case', { p_table: table, p_id: id });
    };
  }, [table, id, take]);

  return { hold, refresh: take, lockedOut: Boolean(hold?.held_by) };
}

export function CaseHoldBanner({ hold, table, id, onReleased }: {
  hold: CaseHold | null; table: CaseTable; id: string; onReleased: () => void;
}) {
  const { me, display } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!hold?.held_by) return null;
  const mayRelease = Boolean((me?.adminDepartments?.length ?? 0) > 0 || me?.departments.some((d) => d.code === 'CMD'));

  async function release(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return setError('Give a reason for releasing it.');
    setBusy(true);
    const { error: err } = await actions.rpc('force_release_case', { p_table: table, p_id: id, p_reason: reason.trim() });
    setBusy(false);
    if (err) return setError(errorText(err));
    setOpen(false);
    onReleased();
  }

  return (
    <div className="case-hold" role="status">
      <div>
        <strong>In hand: <span className="mono">{hold.held_by}</span></strong>
        {hold.held_by_name && <> ({hold.held_by_name})</>} since {formatDateTime(hold.since ?? null, display)}.
        {' '}You can read this case; its actions are locked while they work on it.
      </div>
      <div className="action-row">
        <a className="button outline-button" href="#case-chat">Message {hold.held_by}</a>
        {mayRelease && !open && <button type="button" className="outline-button" onClick={() => setOpen(true)}>Release…</button>}
      </div>
      {open && (
        <form onSubmit={release}>
          <label htmlFor="hold-reason">Reason for releasing it <span className="hint">(posted in the case chat)</span></label>
          <input id="hold-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. KDO off shift, handed to TMB" />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="action-row">
            <button type="submit" disabled={busy}>{busy ? 'Releasing…' : 'Release'}</button>
            <button type="button" className="outline-button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

type Message = { id: string; body: string; kind: string; author: string; author_name: string; created_at: string; mine: boolean };

export function CaseChat({ table, id }: { table: CaseTable; id: string }) {
  const { display } = useAuth();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!isOnline()) return;
    const { data } = await actions.rpc('case_messages', { p_table: table, p_id: id });
    setMessages((data ?? []) as Message[]);
    window.dispatchEvent(new Event('nexus:messages'));    // the bell recounts
  }, [table, id]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function post(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setError('');
    const { error: err } = await actions.rpc('post_case_message', { p_table: table, p_id: id, p_body: text.trim() });
    setBusy(false);
    if (err) return setError(errorText(err));
    setText('');
    await load();
    end.current?.scrollIntoView({ block: 'nearest' });
  }

  return (
    <Section title={`Case chat${messages?.length ? ` (${messages.length})` : ''}`} id="case-chat">
      {messages === null
        ? <p className="small muted" style={{ margin: 0 }}>{isOnline() ? 'Loading…' : 'The case chat needs a connection.'}</p>
        : messages.length === 0
          ? <p className="small muted" style={{ margin: 0 }}>No messages yet. Use this to coordinate on the case; formal questions go in a technical query.</p>
          : (
            <ol className="chat-list">
              {messages.map((m) => (
                <li key={m.id} className={`chat-msg${m.mine ? ' mine' : ''}${m.kind === 'system' ? ' system' : ''}`}>
                  <div className="chat-meta"><span className="mono">{m.author}</span> · {formatDateTime(m.created_at, display)}</div>
                  <div className="chat-body">{m.body}</div>
                </li>
              ))}
            </ol>
          )}
      <div ref={end} />
      <form className="chat-form" onSubmit={post}>
        <label htmlFor={`chat-${id}`} className="visually-hidden">Message</label>
        <textarea id={`chat-${id}`} rows={2} maxLength={2000} placeholder="Write a message" value={text}
          onChange={(e) => setText(e.target.value)} disabled={!isOnline()} />
        {error && <div className="error" role="alert">{error}</div>}
        <div className="action-row">
          <button type="submit" disabled={busy || !text.trim() || !isOnline()}>{busy ? 'Sending…' : 'Send'}</button>
          <span className="small muted">Messages are kept and never edited.</span>
        </div>
      </form>
    </Section>
  );
}
