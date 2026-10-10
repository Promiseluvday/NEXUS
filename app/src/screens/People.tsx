// People, qualifications and certifying authorizations (Phase 2, area A),
// laid out as the Claude Design wireframes WF-PL1 (People list), WF-O1
// (Person record), WF-O2 (Licences, type ratings, medicals) and WF-O3
// (Certifying authorizations).
//
//   /people                            the People list (Quality, Command,
//                                      Super Admins, CO / ECO; D-122)
//   /people/:personId                  Person record (who, 3LC, departments,
//                                      appointment, account state)
//   /people/:personId/qualifications   licences, type ratings, medicals (D-080)
//   /people/:personId/authorizations   certifying authorizations (D-032)
//
// Anyone else sees only their own record. The DATABASE decides who sees
// what and checks every action again (D-125); these screens only guide.
// Nexus records; licensed people decide (D-020): "Can certify today" is a
// check of the records Quality entered, never an airworthiness judgment.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { anyActions, errorText } from '../lib/supabase';
import { formatDateTime, formatPlainDate } from '../lib/format';
import { BackButton, Crumbs, PageHead, Section } from '../components/PageFrame';
import { ACCOUNT_TEXT, type PersonListRow, type PersonRecordData } from './people/types';
import { QualificationsTab, FlagChip } from './people/QualificationsTab';
import { AuthorizationsTab } from './people/AuthorizationsTab';
import '../styles/p2-people.css';

// ---------------------------------------------------------------- WF-PL1
type Waiting = {
  id: string; person_id: string; full_name: string; three_letter_code: string; reference: string;
  aircraft_type_code: string; valid_from: string; expires_on: string; issued_by: string; issued_at: string;
};

export function PeopleList() {
  const { me, display } = useAuth();
  const [rows, setRows] = useState<PersonListRow[] | null>(null);
  const [canView, setCanView] = useState<boolean | null>(null);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [state, setState] = useState('');

  useEffect(() => {
    Promise.all([anyActions.rpc('people_list'), anyActions.rpc('can_view_people'), anyActions.rpc('authorizations_waiting')])
      .then(([list, view, wait]) => {
        if (list.error) setError(errorText(list.error));
        setRows((list.data ?? []) as PersonListRow[]);
        setCanView(Boolean(view.data));
        setWaiting((wait.data ?? []) as Waiting[]);
      });
  }, []);

  const departments = useMemo(() => [...new Set((rows ?? []).map((r) => r.home_department).filter(Boolean) as string[])].sort(), [rows]);
  const shown = useMemo(() => (rows ?? []).filter((r) => {
    if (dept && r.home_department !== dept) return false;
    if (state === 'certifying' && !r.certifying_types) return false;
    if (state === 'flagged' && !r.expiry_flag) return false;
    if (state && !['certifying', 'flagged'].includes(state) && r.account_status !== state) return false;
    const t = q.trim().toLowerCase();
    return !t || [r.full_name, r.three_letter_code, r.appointments ?? ''].some((x) => x.toLowerCase().includes(t));
  }), [rows, q, dept, state]);

  if (!me) return null;
  // Not Quality, Command, a Super Admin or the CO / ECO: your own record only.
  if (canView === false) return <Navigate to={`/people/${me.personId}`} replace />;

  return (
    <div className="page pp-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'People' }]} />
      <BackButton to="/" label="All aircraft" />
      <PageHead title="People" sub="One record per person across all departments (D-085). Quality, Command, department COs and Super Admins.">
        {me.adminDepartments.length > 0 && <Link className="button outline-button" to="/admin/users">Users and roles</Link>}
      </PageHead>
      {error && <div className="error" role="alert">{error}</div>}

      {waiting.length > 0 && (
        <Section title={<>Certifying authorizations waiting for the CO / ECO <span className="pp-count">{waiting.length}</span></>} tone="strong">
          <ul className="pp-waiting">
            {waiting.map((w) => (
              <li key={w.id}>
                <Link to={`/people/${w.person_id}/authorizations`}>
                  <span className="mono">{w.reference}</span> · {w.aircraft_type_code} · {w.full_name} (<span className="mono">{w.three_letter_code}</span>)
                </Link>
                <span className="small muted"> · issued by <span className="mono">{w.issued_by}</span> · {formatDateTime(w.issued_at, display)}</span>
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ margin: 0 }}>Quality issues; the CO or ECO approves with PIN (D-032). Also in the Approvals inbox.</p>
        </Section>
      )}

      <Section title="People">
        <div className="pp-filters">
          <input aria-label="Find a person" placeholder="Name, 3LC or appointment" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Home department" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select aria-label="Show" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Everyone</option>
            <option value="certifying">Can certify today</option>
            <option value="flagged">Expiry approaching or reached</option>
            <option value="active">Active accounts</option>
            <option value="pending">Sign-up pending</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
        {!rows ? <p className="muted">Loading…</p> : (
          <div className="table-scroll">
            <table className="ptable pp-table">
              <thead>
                <tr><th>Person</th><th>3LC</th><th className="pp-hide-sm">Role</th><th>Department</th><th className="pp-hide-sm">Certifying</th><th>State</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.person_id}>
                    <td>
                      <Link to={`/people/${r.person_id}`}>{r.full_name}</Link>
                      {r.rank_or_title && <div className="small muted">{r.rank_or_title}</div>}
                    </td>
                    <td className="mono">{r.three_letter_code}</td>
                    <td className="pp-hide-sm">{r.appointments ?? <span className="muted">—</span>}</td>
                    <td>{r.home_department ?? <span className="muted">—</span>}</td>
                    <td className="pp-hide-sm">
                      {r.certifying_types ? <span className="mono">{r.certifying_types}</span> : <span className="muted">—</span>}
                      {r.pending_authorizations > 0 && <div className="small"><span className="chip tone-blue">{r.pending_authorizations} waiting</span></div>}
                    </td>
                    <td>
                      <span className={`chip ${ACCOUNT_TEXT[r.account_status]?.tone ?? 'tone-grey'}`}>{ACCOUNT_TEXT[r.account_status]?.text ?? r.account_status}</span>
                      {r.expiry_flag && <div className="pp-flag-line"><FlagChip flag={r.expiry_flag} /></div>}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} className="muted">No one matches.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ margin: 0 }}>
          Accounts are created and changed in Users and roles (Super Admins, D-219). Licences, ratings, medicals and certifying authorizations are recorded by Quality.
        </p>
      </Section>
    </div>
  );
}

// ------------------------------------------------------- one person (O1-O3)
export type PersonTab = 'record' | 'qualifications' | 'authorizations';

const TAB_LABEL: Record<PersonTab, string> = {
  record: 'Person record',
  qualifications: 'Licences, ratings, medicals',
  authorizations: 'Certifying authorizations',
};

export function PersonRecordPage() { return <PersonPage tab="record" />; }
export function PersonQualificationsPage() { return <PersonPage tab="qualifications" />; }
export function PersonAuthorizationsPage() { return <PersonPage tab="authorizations" />; }

// Loads the person's record once; each tab reloads it after a signed action.
export function usePersonRecord(personId: string) {
  const [data, setData] = useState<PersonRecordData | null | undefined>(undefined);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data: d, error: err } = await anyActions.rpc('person_record', { p_person: personId });
    if (err) setError(errorText(err));
    setData((d ?? null) as PersonRecordData | null);
  }, [personId]);
  useEffect(() => { load(); }, [load]);
  return { data, error, load };
}

export function PersonPage({ tab }: { tab: PersonTab }) {
  const { personId = '' } = useParams();
  const { me } = useAuth();
  const { data, error, load } = usePersonRecord(personId);
  const [message, setMessage] = useState('');
  const done = (m: string) => { setMessage(m); load(); };
  useEffect(() => { setMessage(''); }, [tab, personId]);

  if (!me) return null;
  if (data === undefined) return <div className="page muted">Loading…</div>;
  if (data === null) {
    return (
      <div className="page pp-page">
        <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'People', to: '/people' }, { label: 'Person record' }]} />
        <BackButton to="/" label="All aircraft" />
        <Section title="Person record">
          <p style={{ margin: 0 }}>{error || 'This record is not available to you. Quality, Command, department COs and Super Admins see everyone; anyone else sees their own record (D-122, D-125).'}</p>
          <Link to={`/people/${me.personId}`}>Open my own record</Link>
        </Section>
      </div>
    );
  }

  const p = data.person;
  const base = `/people/${p.id}`;
  const own = p.id === me.personId;
  const crumbs = [
    { label: 'All aircraft', to: '/' },
    ...(data.can.view_people ? [{ label: 'People', to: '/people' }] : []),
    { label: p.full_name, to: base },
    ...(tab !== 'record' ? [{ label: TAB_LABEL[tab] }] : []),
  ];

  return (
    <div className="page pp-page">
      <Crumbs items={crumbs} />
      {tab === 'record'
        ? (data.can.view_people ? <BackButton to="/people" label="People" /> : <BackButton to="/" label="All aircraft" />)
        : <BackButton to={base} label="Person record" />}
      <PageHead
        title={<>{p.full_name} <span className="pp-tlc mono">{p.three_letter_code}</span></>}
        sub={[p.rank_or_title, data.home_department, data.appointments].filter(Boolean).join(' · ') || undefined}>
        {data.certifying_types.length > 0
          ? <span className="chip tone-green">Certifying · {data.certifying_types.join(', ')}</span>
          : <span className="chip tone-grey">Not certifying</span>}
      </PageHead>

      <nav aria-label="Person sections" className="tail-tabs">
        <NavLink to={base} end>{TAB_LABEL.record}</NavLink>
        <NavLink to={`${base}/qualifications`}>{TAB_LABEL.qualifications}</NavLink>
        <NavLink to={`${base}/authorizations`}>{TAB_LABEL.authorizations}</NavLink>
      </nav>

      {message && <div className="success" role="status">{message}</div>}
      {own && tab !== 'record' && (
        <div className="notice">This is your own record. Nobody records or approves their own qualifications or authorizations (D-033).</div>
      )}

      {tab === 'record' && <RecordTab data={data} />}
      {tab === 'qualifications' && <QualificationsTab data={data} onDone={done} />}
      {tab === 'authorizations' && <AuthorizationsTab data={data} onDone={done} />}
    </div>
  );
}

// ------------------------------------------------------------------ WF-O1
function RecordTab({ data }: { data: PersonRecordData }) {
  const { display } = useAuth();
  const p = data.person;
  const base = `/people/${p.id}`;
  const quals = (data.qualifications ?? []).filter((q) => !q.superseded_at);
  const flagged = quals.filter((q) => q.flag === 'approaching' || q.flag === 'reached');
  const auths = data.authorizations.filter((a) => ['active', 'approaching', 'not_yet_valid', 'pending', 'expired'].includes(a.state));
  const account = ACCOUNT_TEXT[data.account_status] ?? { text: data.account_status, tone: 'tone-grey' };

  return (
    <>
      <Section title="Who">
        <dl className="facts pp-facts">
          <dt>Name</dt><dd>{p.full_name}{p.rank_or_title && <span className="muted"> · {p.rank_or_title}</span>}</dd>
          <dt>3LC <span className="hint">(three-letter code)</span></dt>
          <dd><span className="mono pp-tlc-big">{p.three_letter_code}</span> <span className="small muted">unique · printed in Name columns (D-162)</span></dd>
          {p.service_number && <><dt>Service number</dt><dd className="mono">{p.service_number}</dd></>}
          <dt>Departments</dt><dd>{data.departments ?? <span className="muted">None</span>}</dd>
          <dt>Appointment</dt><dd>{data.appointments ?? <span className="muted">None</span>}</dd>
          {data.sections && <><dt>Engineering sections</dt><dd>{data.sections}</dd></>}
          <dt>Aircraft scope</dt><dd>{data.scope ?? <span className="muted">No aircraft</span>}</dd>
        </dl>
      </Section>

      <Section title="Account">
        <div className="action-row">
          <span className={`chip ${account.tone}`}>{account.text}</span>
          <span className="small muted">Accounts are deactivated, never deleted (D-030).</span>
        </div>
        {data.can.manage_account
          ? <Link to={`/admin/users/${p.id}`}>Manage in Users and roles (Super Admins)</Link>
          : <p className="small muted" style={{ margin: 0 }}>Departments, permissions and aircraft scope are set by a Super Admin in Users and roles (D-123).</p>}
      </Section>

      <div className="pp-tiles">
        <Tile to={`${base}/qualifications`} title="Licences, ratings, medicals">
          {data.qualifications === null ? <span className="muted">Not shown to you</span> : (
            <>
              <strong>{quals.length}</strong> current record{quals.length === 1 ? '' : 's'}
              {flagged.length > 0 && <div className="pp-tile-flags">{flagged.map((q) => <FlagChip key={q.id} flag={q.flag!} label={`${q.kind === 'type_rating' ? q.aircraft_type_code : q.kind === 'medical' ? 'Medical' : 'Licence'} ${q.flag === 'reached' ? 'expired' : 'approaching'}`} />)}</div>}
            </>
          )}
        </Tile>
        <Tile to={`${base}/authorizations`} title="Certifying authorizations">
          {auths.length === 0 ? <span className="muted">None</span> : (
            <ul className="pp-tile-list">
              {auths.map((a) => (
                <li key={a.id}>
                  <span className="mono">{a.aircraft_type_code}</span>{' '}
                  {a.state === 'pending' ? <span className="chip tone-blue">Waiting for CO / ECO</span>
                    : a.state === 'expired' ? <span className="chip tone-red">Expired {formatPlainDate(a.expires_on, display)}</span>
                    : <span className="small muted">expires {formatPlainDate(a.expires_on, display)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </div>
      <p className="panel-note">Crew scheduling will read these dates when it is built (D-017, D-085) <span className="rail-tag">Soon</span></p>
    </>
  );
}

// The whole tile is the link (D-098).
function Tile({ to, title, children }: { to: string; title: string; children: ReactNode }) {
  return (
    <Link to={to} className="pp-tile">
      <span className="pp-tile-title">{title} ›</span>
      <span className="pp-tile-body">{children}</span>
    </Link>
  );
}

