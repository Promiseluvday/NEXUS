// Technical queries (D-207), laid out as the Claude Design wireframes:
//   /queries            the list (WF-TQ1): three views, filters, a table
//   /queries?q=<id>     one query (WF-TQ2): the question, notes, add a note,
//                       close (only whoever raised it)
//   /queries?raise=1    raise a query (WF-TQ3): first choose the snag or work
//                       order it is about, so a query is always attached to
//                       a record; from a record page the record is filled in
// You only see queries you are involved in (raised it, assigned to your
// department, or oversight); the database decides. A query never changes
// the record it is about.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import { formatDateTime, formatPlainDate } from '../lib/format';
import {
  DEPARTMENTS, QUERY_SELECT, QueryDetail, QueryStateChip, RaiseQuery, RecordLink, deptName, useRecordLabels,
  type QueryRow,
} from '../components/Queries';
import { DateField } from '../components/DateField';
import { BackButton, Crumbs, PageHead, Section } from '../components/PageFrame';

// Everything I may see, loaded once; the views and filters work on it here.
function useQueries() {
  const [rows, setRows] = useState<QueryRow[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await db.from('technical_query').select(QUERY_SELECT)
      .order('urgent', { ascending: false }).order('created_at', { ascending: false });
    setRows((data ?? []) as unknown as QueryRow[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { rows, load };
}

export function QueryList() {
  const [params] = useSearchParams();
  const { rows, load } = useQueries();
  const id = params.get('q');
  if (params.get('raise')) return <RaiseFromList onRaised={load} />;
  if (id) return <QueryPage q={rows?.find((r) => r.id === id) ?? null} loaded={rows !== null} onChange={load} />;
  return <QueryTable rows={rows} />;
}

// ------------------------------------------------------------ list (TQ1)
type View = 'mine' | 'raised' | 'all';

function QueryTable({ rows }: { rows: QueryRow[] | null }) {
  const { me, display } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('mine');
  const [state, setState] = useState('open');
  const [dept, setDept] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const labels = useRecordLabels(rows);

  const myDepts = useMemo(() => new Set(me?.departments.map((d) => d.code) ?? []), [me]);
  const inView = useCallback((q: QueryRow, v: View) => {
    if (v === 'raised') return q.raised_by === me?.personId;
    if (v === 'mine') return q.raised_by !== me?.personId
      && (q.assigned_person === me?.personId || (q.assigned_department !== null && myDepts.has(q.assigned_department)));
    return true;
  }, [me, myDepts]);
  const count = (v: View) => (rows ?? []).filter((q) => inView(q, v) && q.status === 'open').length;

  const shown = (rows ?? []).filter((q) => inView(q, view)
    && (state === 'all' || q.status === state)
    && (!dept || q.assigned_department === dept)
    && (!from || (q.due_on !== null && q.due_on >= from))
    && (!to || (q.due_on !== null && q.due_on <= to)));

  const VIEWS: { key: View; label: string }[] = [
    { key: 'mine', label: 'Assigned to me or my group' },
    { key: 'raised', label: 'Raised by me' },
    { key: 'all', label: 'All I can see' },
  ];

  return (
    <div className="page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Technical queries' }]} />
      <BackButton to="/" label="All aircraft" />
      <PageHead title="Technical queries" sub="Questions raised against records, between people and departments">
        <Link className="button" to="/queries?raise=1">Raise query</Link>
      </PageHead>

      <div className="chips-row" role="group" aria-label="Which queries">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" className="fchip" aria-pressed={view === v.key} onClick={() => setView(v.key)}>
            {v.label} ({count(v.key)} open)
          </button>
        ))}
      </div>

      <div className="tq-filters">
        <div>
          <label htmlFor="tq-state">State</label>
          <select id="tq-state" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label htmlFor="tq-fdept">Department</label>
          <select id="tq-fdept" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All</option>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tq-from">Due from</label>
          <DateField id="tq-from" value={from} onChange={setFrom} />
        </div>
        <div>
          <label htmlFor="tq-to">Due to</label>
          <DateField id="tq-to" value={to} onChange={setTo} />
        </div>
        {(from || to || dept) && (
          <button type="button" className="outline-button tq-clear" onClick={() => { setFrom(''); setTo(''); setDept(''); }}>Clear filters</button>
        )}
      </div>

      {rows === null && <p className="muted">Loading…</p>}
      {rows && shown.length === 0 && <div className="box"><div className="box-body"><p className="muted tq-empty">No queries match.</p></div></div>}
      {shown.length > 0 && (
        <table className="board tq-table">
          <thead>
            <tr><th>Query</th><th>Subject</th><th>Record</th><th>Raised by</th><th>Assigned to</th><th>Due</th><th>State</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {shown.map((q) => (
              <tr key={q.id} onClick={() => navigate(`/queries?q=${q.id}`)}>
                <td data-label="Query"><Link className="mono" to={`/queries?q=${q.id}`} onClick={(e) => e.stopPropagation()}>{q.number}</Link></td>
                <td data-label="Subject">{q.subject}</td>
                <td data-label="Record" onClick={(e) => e.stopPropagation()}><RecordLink q={q} labels={labels} /></td>
                <td data-label="Raised by" className="mono">{q.raiser?.three_letter_code}</td>
                <td data-label="Assigned to">{q.assigned_department ? `${deptName(q.assigned_department)} (group)` : 'A person'}</td>
                <td data-label="Due">{q.due_on ? formatPlainDate(q.due_on, display) : '—'}</td>
                <td data-label="State"><QueryStateChip q={q} /></td>
                <td data-label="Notes" className="mono">{q.notes.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Section title="Rules">
        <ul className="tq-rules">
          <li>Anyone can raise a query on a record they can see; the query shows only to people involved who can see that record (D-125).</li>
          <li>A query goes to a department queue; anyone in that department can add notes.</li>
          <li>Only the person who raised it closes it (D-207).</li>
          <li>A query never changes the record it is about.</li>
          <li>Notes are added, never edited or deleted; each carries the three-letter code and time.</li>
        </ul>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------- one query (TQ2)
function QueryPage({ q, loaded, onChange }: { q: QueryRow | null; loaded: boolean; onChange: () => void }) {
  const { display } = useAuth();
  const labels = useRecordLabels(q ? [q] : null);
  const head = (
    <>
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Technical queries', to: '/queries' }, { label: q?.number ?? 'Query' }]} />
      <BackButton to="/queries" label="Technical queries" />
    </>
  );
  if (!loaded) return <div className="page">{head}<p className="muted">Loading…</p></div>;
  if (!q) return <div className="page">{head}<p>This query is not one you are involved in, or it does not exist.</p></div>;

  return (
    <div className="page">
      {head}
      <PageHead title={<><span className="mono">{q.number}</span> · {q.subject}</>}
        sub={<>Raised {formatDateTime(q.created_at, display)} by <span className="mono">{q.raiser?.three_letter_code}</span>
          {q.due_on && <> · due {formatPlainDate(q.due_on, display)}</>}</>} />
      <Section title="Query">
        <dl className="facts tq-facts">
          <dt>Record</dt><dd><RecordLink q={q} labels={labels} /></dd>
          <dt>Assigned to</dt><dd>{q.assigned_department ? `${deptName(q.assigned_department)} (group)` : 'A person'}</dd>
          <dt>State</dt><dd><QueryStateChip q={q} /></dd>
        </dl>
      </Section>
      <Section title="Question and notes">
        <QueryDetail q={q} onChange={onChange} />
      </Section>
      <p className="small muted">Whoever is waiting on the record sees this query on it, so nobody has to chase it by phone. The query never changes the record (D-207).</p>
    </div>
  );
}

// ------------------------------------------------- raise from the list (TQ3)
// Pick the record first (snags and work orders you can see, newest first).
type Pick = { id: string; number: string; text: string; aircraft: { tail: string } | null };

function RaiseFromList({ onRaised }: { onRaised: () => void }) {
  const navigate = useNavigate();
  const [table, setTable] = useState<'snag' | 'work_order'>('snag');
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [chosen, setChosen] = useState('');
  useEffect(() => {
    setPicks(null);
    setChosen('');
    const q = table === 'snag'
      ? db.from('snag').select('id, number, text:description, aircraft:aircraft_id (tail)').neq('status', 'closed')
      : db.from('work_order').select('id, number, text:scope, aircraft:aircraft_id (tail)').not('status', 'in', '(certified,rejected,cancelled)');
    q.order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setPicks((data ?? []) as unknown as Pick[]));
  }, [table]);
  const rec = picks?.find((p) => p.id === chosen);

  return (
    <div className="page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Technical queries', to: '/queries' }, { label: 'Raise' }]} />
      <BackButton to="/queries" label="Technical queries" />
      <PageHead title="Raise a technical query" sub="A query is always about a record. From a snag or work order page the record is filled in for you." />
      <Section title="What is it about?">
        <div className="tq-grid3">
          <div>
            <label htmlFor="tq-kind">Record type</label>
            <select id="tq-kind" value={table} onChange={(e) => setTable(e.target.value as 'snag' | 'work_order')}>
              <option value="snag">Snag (open)</option>
              <option value="work_order">Work order (not yet certified)</option>
            </select>
          </div>
          <div className="tq-span2">
            <label htmlFor="tq-rec">Record</label>
            <select id="tq-rec" value={chosen} onChange={(e) => setChosen(e.target.value)} disabled={!picks}>
              <option value="">{picks ? (picks.length ? 'Choose…' : 'None you can see') : 'Loading…'}</option>
              {picks?.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.aircraft?.tail} · {p.text.slice(0, 70)}</option>)}
            </select>
          </div>
        </div>
        <p className="small muted">Queries on NADDs and DDLS entries <span className="rail-tag">Soon</span></p>
      </Section>
      {rec && (
        <Section title="The query">
          <RaiseQuery key={rec.id} recordTable={table} recordId={rec.id} recordText={`${rec.number} · ${rec.aircraft?.tail ?? ''}`}
            onDone={(newId) => { onRaised(); navigate(newId ? `/queries?q=${newId}` : '/queries'); }}
            onCancel={() => navigate('/queries')} />
        </Section>
      )}
    </div>
  );
}
