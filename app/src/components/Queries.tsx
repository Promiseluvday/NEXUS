// Technical queries on a record (D-207).
// A question thread attached to a snag, work order, NADD or DDLS entry,
// assigned to a department queue, with an optional due date and an "urgent"
// flag (urgent = it holds an aircraft). Notes are added, never edited. Only
// whoever raised it closes it. A query NEVER changes the record it is about.
// You only see queries you are involved in (the database decides).
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { db, errorText } from '../lib/supabase';
import { formatDateTime, formatPlainDate } from '../lib/format';
import { DateField } from './DateField';

export type QueryRow = {
  id: string; number: string; subject: string; body: string; status: string; urgent: boolean;
  due_on: string | null; created_at: string; closed_at: string | null;
  assigned_department: string | null; raised_by: string; record_table: string; record_id: string;
  raiser: { three_letter_code: string } | null;
  notes: { id: string; note: string; created_at: string; writer: { three_letter_code: string } | null }[];
};

export const QUERY_SELECT = `id, number, subject, body, status, urgent, due_on, created_at, closed_at,
  assigned_department, raised_by, record_table, record_id, raiser:raised_by (three_letter_code),
  notes:technical_query_note (id, note, created_at, writer:author (three_letter_code))`;

type Props = { recordTable: 'snag' | 'work_order' | 'nadd' | 'ddls_entry'; recordId: string; startOpen?: boolean };

export function Queries({ recordTable, recordId, startOpen = false }: Props) {
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [raising, setRaising] = useState(startOpen);
  const load = useCallback(async () => {
    const { data } = await db.from('technical_query').select(QUERY_SELECT)
      .eq('record_table', recordTable).eq('record_id', recordId).order('created_at');
    setRows((data ?? []) as unknown as QueryRow[]);
  }, [recordTable, recordId]);
  useEffect(() => { load(); }, [load]);
  // Opened from "＋ New ▸ Raise technical query": bring the form into view.
  useEffect(() => {
    if (startOpen) {
      setRaising(true);
      document.getElementById('queries')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [startOpen]);

  return (
    <section className="card" id="queries">
      <h2>Technical queries</h2>
      {rows.length === 0 && !raising && <p className="small muted">No queries you are involved in.</p>}
      {rows.map((q) => <QueryThread key={q.id} q={q} onChange={load} />)}
      {raising
        ? <RaiseQuery recordTable={recordTable} recordId={recordId} onDone={() => { setRaising(false); load(); }} onCancel={() => setRaising(false)} />
        : <p><button type="button" className="secondary" onClick={() => setRaising(true)}>Raise a query…</button></p>}
    </section>
  );
}

export function QueryThread({ q, onChange, showRecordLink }: { q: QueryRow; onChange: () => void; showRecordLink?: ReactNode }) {
  const { me, display } = useAuth();
  const [open, setOpen] = useState(q.status === 'open');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = q.raised_by === me?.personId;

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    const { error: err } = await db.from('technical_query_note').insert({
      query_id: q.id, note: note.trim(), author: me?.personId ?? '', device_time: new Date().toISOString(),
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    setNote('');
    setError('');
    onChange();
  }
  async function close() {
    setBusy(true);
    const { error: err } = await db.from('technical_query').update({ status: 'closed' }).eq('id', q.id);
    setBusy(false);
    if (err) return setError(errorText(err));
    onChange();
  }

  return (
    <div className="query">
      <button type="button" className="query-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="mono">{q.number}</span>
        <strong>{q.subject}</strong>
        {q.urgent && <span className="chip tone-red">Urgent</span>}
        <span className={`chip tone-${q.status === 'open' ? 'blue' : 'grey'}`}>{q.status === 'open' ? 'Open' : 'Closed'}</span>
        <span className="small muted">to {q.assigned_department ?? 'person'}{q.due_on && ` · due ${formatPlainDate(q.due_on, display)}`}</span>
        <span className="caret" aria-hidden>▸</span>
      </button>
      {open && (
        <div className="query-body">
          {showRecordLink}
          <p>{q.body}<span className="small muted"> · <span className="mono">{q.raiser?.three_letter_code}</span> · {formatDateTime(q.created_at, display)}</span></p>
          <ol className="timeline">
            {q.notes.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)).map((n) => (
              <li key={n.id}>{n.note}<div className="small muted"><span className="mono">{n.writer?.three_letter_code}</span> · {formatDateTime(n.created_at, display)}</div></li>
            ))}
          </ol>
          {q.status === 'open' && (
            <form onSubmit={addNote} className="row note-row">
              <input aria-label="Add a note" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
              <button type="submit" disabled={busy}>Add note</button>
              {mine && <button type="button" className="secondary" disabled={busy} onClick={close}>Close query</button>}
            </form>
          )}
          {error && <div className="error" role="alert">{error}</div>}
        </div>
      )}
    </div>
  );
}

const DEPARTMENTS = [
  { code: 'QUA', name: 'Quality' }, { code: 'ENG', name: 'Engineering' }, { code: 'OPS', name: 'Operations' },
  { code: 'SUP', name: 'Supply' }, { code: 'PRO', name: 'Procurement' }, { code: 'CMD', name: 'Command' },
];

function RaiseQuery({ recordTable, recordId, onDone, onCancel }: {
  recordTable: string; recordId: string; onDone: () => void; onCancel: () => void;
}) {
  const { me } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dept, setDept] = useState('QUA');
  const [due, setDue] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!subject.trim() || !body.trim()) return setError('Give a subject and the question.');
    setBusy(true);
    const { error: err } = await db.from('technical_query').insert({
      record_table: recordTable, record_id: recordId, subject: subject.trim(), body: body.trim(),
      assigned_department: dept, due_on: due || null, urgent,
      number: 'auto', raised_by: me?.personId ?? '', // both set by the database (D-207)
      device_time: new Date().toISOString(),
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone();
  }
  return (
    <form className="card inset" onSubmit={submit}>
      <h3>Raise a technical query</h3>
      <p className="small muted">The query never changes this record (D-207).</p>
      <label htmlFor="tq-subject">Subject</label>
      <input id="tq-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <label htmlFor="tq-body">Question</label>
      <textarea id="tq-body" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="row">
        <div>
          <label htmlFor="tq-dept">Send to</label>
          <select id="tq-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tq-due">Answer needed by <span className="hint">(optional)</span></label>
          <DateField id="tq-due" value={due} onChange={setDue} />
        </div>
      </div>
      <label className="check"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
        <span>Urgent: this holds an aircraft</span></label>
      {error && <div className="error" role="alert">{error}</div>}
      <p className="row">
        <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Raise query'}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </p>
    </form>
  );
}
