// Technical queries on a record (D-207; layout from the Claude Design
// wireframes WF-TQ1 list, WF-TQ2 detail, WF-TQ3 raise).
// A question thread attached to a snag, work order, NADD or DDLS entry,
// assigned to a department queue, with an optional due date and an "urgent"
// flag (urgent = it holds an aircraft). Notes are added, never edited. Only
// whoever raised it closes it. A query NEVER changes the record it is about.
// You only see queries you are involved in (the database decides).
//
// Pieces shared with the Technical queries screen (screens/QueryList.tsx):
//   Queries        the box on a snag or work order page
//   QueryDetail    the question, the notes, add a note, close (TQ2)
//   RaiseQuery     the raise form (TQ3), with the record already filled in
//   useRecordLabels  "SNAG-000004 · NX-203" for each query's record
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { db, errorText } from '../lib/supabase';
import { formatDateTime, formatPlainDate } from '../lib/format';
import { DateField } from './DateField';
import { Section } from './PageFrame';

export type QueryRow = {
  id: string; number: string; subject: string; body: string; status: string; urgent: boolean;
  due_on: string | null; created_at: string; closed_at: string | null;
  assigned_department: string | null; assigned_person: string | null; raised_by: string;
  record_table: string; record_id: string;
  raiser: { three_letter_code: string } | null;
  closer: { three_letter_code: string } | null;
  notes: { id: string; note: string; created_at: string; author: string; writer: { three_letter_code: string } | null }[];
};

export const QUERY_SELECT = `id, number, subject, body, status, urgent, due_on, created_at, closed_at,
  assigned_department, assigned_person, raised_by, record_table, record_id,
  raiser:raised_by (three_letter_code), closer:closed_by (three_letter_code),
  notes:technical_query_note (id, note, created_at, author, writer:author (three_letter_code))`;

// Department queues a query can be sent to. Names follow the department
// table; "A person" is not offered yet (the database allows it, the screen
// to pick a person comes later).
export const DEPARTMENTS = [
  { code: 'QUA', name: 'Quality' }, { code: 'ENG', name: 'Engineering' }, { code: 'OPS', name: 'Operations' },
  { code: 'SUP', name: 'Supply' }, { code: 'PRO', name: 'Procurement' }, { code: 'CMD', name: 'Command' },
];
export const deptName = (code: string | null) => DEPARTMENTS.find((d) => d.code === code)?.name ?? code ?? '';

export const RECORD_NAME: Record<string, string> = {
  snag: 'Snag', work_order: 'Work order', nadd: 'NADD', ddls_entry: 'DDLS entry', mel_revision: 'MEL revision',
};

// ---------------------------------------------------------- record labels
// A query only knows "which table, which id". This looks up the number and
// tail of each record so the list can show "SNAG-000004 · NX-203" and link to it.
export type RecordLabel = { text: string; to?: string };
type Rec = { id: string; aircraft_id: string; aircraft: { tail: string } | null };

export function useRecordLabels(rows: { record_table: string; record_id: string }[] | null): Record<string, RecordLabel> {
  const [labels, setLabels] = useState<Record<string, RecordLabel>>({});
  const key = (rows ?? []).map((r) => r.record_id).sort().join(',');
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    const ids = (table: string) => [...new Set(rows.filter((r) => r.record_table === table).map((r) => r.record_id))];
    const out: Record<string, RecordLabel> = {};
    const jobs: PromiseLike<unknown>[] = [];
    const snags = ids('snag');
    if (snags.length) jobs.push(db.from('snag').select('id, number, aircraft_id, aircraft:aircraft_id (tail)').in('id', snags)
      .then(({ data }) => ((data ?? []) as unknown as (Rec & { number: string })[]).forEach((s) => {
        out[s.id] = { text: `${s.number} · ${s.aircraft?.tail ?? ''}`, to: `/snags/${s.id}` };
      })));
    const wos = ids('work_order');
    if (wos.length) jobs.push(db.from('work_order').select('id, number, aircraft_id, aircraft:aircraft_id (tail)').in('id', wos)
      .then(({ data }) => ((data ?? []) as unknown as (Rec & { number: string })[]).forEach((w) => {
        out[w.id] = { text: `${w.number} · ${w.aircraft?.tail ?? ''}`, to: `/work-orders/${w.id}` };
      })));
    const nadds = ids('nadd');
    if (nadds.length) jobs.push(db.from('nadd').select('id, number, aircraft_id, aircraft:aircraft_id (tail)').in('id', nadds)
      .then(({ data }) => ((data ?? []) as unknown as (Rec & { number: string })[]).forEach((n) => {
        out[n.id] = { text: `${n.number} · ${n.aircraft?.tail ?? ''}`, to: `/nadds?aircraft=${n.aircraft_id}` };
      })));
    const ddls = ids('ddls_entry');
    if (ddls.length) jobs.push(db.from('ddls_entry').select('id, page_no, entry_no, aircraft_id, aircraft:aircraft_id (tail)').in('id', ddls)
      .then(({ data }) => ((data ?? []) as unknown as (Rec & { page_no: number; entry_no: number })[]).forEach((e) => {
        out[e.id] = { text: `DDLS p${e.page_no} item ${e.entry_no} · ${e.aircraft?.tail ?? ''}`, to: `/ddls?aircraft=${e.aircraft_id}` };
      })));
    Promise.all(jobs).then(() => setLabels(out));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return labels;
}

export function RecordLink({ q, labels }: { q: { record_table: string; record_id: string }; labels: Record<string, RecordLabel> }) {
  const l = labels[q.record_id];
  if (!l) return <span>{RECORD_NAME[q.record_table] ?? q.record_table}</span>;
  return l.to ? <Link className="mono" to={l.to}>{l.text}</Link> : <span className="mono">{l.text}</span>;
}

// The state of a query in words. The database has only Open and Closed;
// "answered" (WF-TQ1) is not a separate state yet.
export function QueryStateChip({ q }: { q: QueryRow }) {
  return (
    <span className="tq-chips">
      <span className={`chip tone-${q.status === 'open' ? 'blue' : 'grey'}`}>{q.status === 'open' ? 'Open' : 'Closed'}</span>
      {q.urgent && <span className="chip tone-red">Urgent</span>}
    </span>
  );
}

// ------------------------------------------------- the box on a record page
type Props = { recordTable: 'snag' | 'work_order' | 'nadd' | 'ddls_entry'; recordId: string; startOpen?: boolean };

export function Queries({ recordTable, recordId, startOpen = false }: Props) {
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [raising, setRaising] = useState(startOpen);
  const labels = useRecordLabels([{ record_table: recordTable, record_id: recordId }]);
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
    <Section title="Technical queries" id="queries"
      actions={!raising && <button type="button" className="outline-button" onClick={() => setRaising(true)}>Raise query</button>}>
      {rows.length === 0 && !raising && <p className="small muted tq-empty">No queries you are involved in.</p>}
      {rows.map((q) => <QueryThread key={q.id} q={q} onChange={load} />)}
      {raising && (
        <RaiseQuery recordTable={recordTable} recordId={recordId}
          recordText={labels[recordId]?.text ?? `this ${(RECORD_NAME[recordTable] ?? 'record').toLowerCase()}`}
          onDone={() => { setRaising(false); load(); }} onCancel={() => setRaising(false)} />
      )}
    </Section>
  );
}

// One query on a record page: a bar that opens to the full thread.
export function QueryThread({ q, onChange }: { q: QueryRow; onChange: () => void }) {
  const { display } = useAuth();
  const [open, setOpen] = useState(q.status === 'open');
  return (
    <div className="query">
      <button type="button" className="query-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="mono">{q.number}</span>
        <strong>{q.subject}</strong>
        <QueryStateChip q={q} />
        <span className="small muted">to {deptName(q.assigned_department) || 'a person'}{q.due_on && ` · due ${formatPlainDate(q.due_on, display)}`}</span>
        <span className="caret" aria-hidden>▸</span>
      </button>
      {open && (
        <div className="query-body">
          <QueryDetail q={q} onChange={onChange} />
          <Link className="small" to={`/queries?q=${q.id}`}>Open on the Technical queries page</Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------- question, notes, actions (TQ2)
export function QueryDetail({ q, onChange }: { q: QueryRow; onChange: () => void }) {
  const { me, display } = useAuth();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = q.raised_by === me?.personId;
  const notes = q.notes.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return setError('Write the note first.');
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
    if (!window.confirm(`Close ${q.number}? No more notes can be added after this.`)) return;
    setBusy(true);
    const { error: err } = await db.from('technical_query').update({ status: 'closed' }).eq('id', q.id);
    setBusy(false);
    if (err) return setError(errorText(err));
    onChange();
  }

  return (
    <div className="tq-detail">
      <div className="tq-question">
        <div className="tq-k">Question</div>
        <p>{q.body}</p>
        <div className="small muted"><span className="mono">{q.raiser?.three_letter_code}</span> · {formatDateTime(q.created_at, display)}</div>
      </div>

      <div className="tq-k">Notes (newest last)</div>
      {notes.length === 0
        ? <p className="small muted tq-empty">No notes yet.</p>
        : (
          <table className="board sheet-table tq-notes">
            <thead><tr><th>When</th><th>Who</th><th>Note</th></tr></thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id}>
                  <td className="small mono">{formatDateTime(n.created_at, display)}</td>
                  <td className="mono">{n.writer?.three_letter_code}</td>
                  <td>{n.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      {q.status === 'open' ? (
        <form onSubmit={addNote} className="tq-note-form">
          <label htmlFor={`note-${q.id}`}>Add a note <span className="hint">(notes are never edited, D-207)</span></label>
          <textarea id={`note-${q.id}`} rows={3} placeholder="Write your note" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="action-row">
            <button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add note'}</button>
            <span className="outline-button button tq-soon" aria-disabled="true">Add photo or PDF <span className="rail-tag">Soon</span></span>
            {mine
              ? <button type="button" className="outline-button" disabled={busy} onClick={close}>Close query</button>
              : <button type="button" className="outline-button" disabled title="Only the person who raised it can close it (D-207)">Close (only the person who raised it)</button>}
          </div>
        </form>
      ) : (
        <p className="small muted">Closed{q.closer && <> by <span className="mono">{q.closer.three_letter_code}</span></>} · {formatDateTime(q.closed_at, display)}. No more notes can be added.</p>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}

// ------------------------------------------------------------- raise (TQ3)
export function RaiseQuery({ recordTable, recordId, recordText, onDone, onCancel }: {
  recordTable: string; recordId: string; recordText: string;
  onDone: (newId?: string) => void; onCancel: () => void;
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
    const { data, error: err } = await db.from('technical_query').insert({
      record_table: recordTable, record_id: recordId, subject: subject.trim(), body: body.trim(),
      assigned_department: dept, due_on: due || null, urgent,
      number: 'auto', raised_by: me?.personId ?? '', // both set by the database (D-207)
      device_time: new Date().toISOString(),
    }).select('id').maybeSingle();
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone((data as { id: string } | null)?.id);
  }
  return (
    <form className="tq-raise" onSubmit={submit}>
      <dl className="facts tq-facts">
        <dt>Record</dt><dd><span className="mono">{recordText}</span> <span className="small muted">(filled in from where you started)</span></dd>
        <dt>Raised by</dt><dd>{me?.fullName} (<span className="mono">{me?.tlc}</span>) <span className="small muted">· from sign-in</span></dd>
      </dl>
      <label htmlFor="tq-subject">Subject</label>
      <input id="tq-subject" value={subject} placeholder="Short title, e.g. Which AMM revision applies?" onChange={(e) => setSubject(e.target.value)} />
      <label htmlFor="tq-body">Question</label>
      <textarea id="tq-body" rows={3} value={body} placeholder="What is wrong and what you need" onChange={(e) => setBody(e.target.value)} />
      <div className="tq-grid3">
        <div>
          <label htmlFor="tq-dept">Assign to</label>
          <select id="tq-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>Department queue: {d.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tq-due">Answer needed by <span className="hint">(optional)</span></label>
          <DateField id="tq-due" value={due} onChange={setDue} />
        </div>
        <div>
          <label htmlFor="tq-urgent">Priority</label>
          <select id="tq-urgent" value={urgent ? 'urgent' : 'normal'} onChange={(e) => setUrgent(e.target.value === 'urgent')}>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent (holds an aircraft)</option>
          </select>
        </div>
      </div>
      <p className="small muted">The query never changes the record (D-207). Photos and PDFs on queries <span className="rail-tag">Soon</span></p>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Raise query'}</button>
        <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
