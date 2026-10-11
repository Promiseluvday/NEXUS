// Users and roles: the Super Admin screens (canvas CreateAccount.dc.html and
// AccountPage.dc.html; D-030, D-033, D-035, D-121 to D-124, D-127, D-206, D-219).
//
//   /admin/users            list: pending requests first, then everyone the
//                           Super Admin looks after (the Commander: everyone)
//   /admin/users/new        create an account with a temporary password
//   /admin/users/:personId  one account: departments, permissions, aircraft
//                           scope, stores, sections, status, password, and the
//                           change log
//
// Every change needs a reason and the Super Admin's own PIN. The DATABASE
// checks all the rules again (who may change whom, nobody changes their own
// account, Quality never gets "View cost"); the screens only guide.
// Certifying privileges are not given here (D-032): Quality issues them.
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import { isValidUsername } from '../lib/username';
import { PinField } from '../components/PinField';
import type { Json } from '../lib/database.types';
import { BackButton, Crumbs, PageHead, Section } from '../components/PageFrame';

// ------------------------------------------------------------- data types
type Option = { code: string; name: string };
type Options = {
  departments: (Option & { kind: string })[];
  permissions: (Option & { department: string | null })[];
  sections: Option[];
  types: Option[];
  aircraft: { id: string; tail: string; type: string }[];
  stores: Option[];
  mine: string[];
};
type Scope = { kind: 'all' | 'types' | 'tails' | 'none'; types: string[]; tails: string[] };
export type Access = {
  departments: { home: string; extra: string[] };
  permissions: string[];
  sections: string[];
  scope: Scope;
  stores: string[];
};
type Category = 'departments' | 'permissions' | 'sections' | 'scope' | 'stores';
type PersonRow = {
  person_id: string; full_name: string; rank_or_title: string | null; three_letter_code: string; username: string | null;
  status: string; home_department: string | null; departments: string | null; permissions: string | null; scope: string | null;
  requested_department: string | null; must_change_password: boolean; created_at: string;
};

const EMPTY: Access = {
  departments: { home: '', extra: [] }, permissions: [], sections: [],
  scope: { kind: 'none', types: [], tails: [] }, stores: [],
};

const STATUS_CHIP: Record<string, string> = { active: 'tone-green', pending: 'tone-blue', deactivated: 'tone-grey' };
const STATUS_TEXT: Record<string, string> = { active: 'Active', pending: 'Request waiting', deactivated: 'Deactivated' };

function useOptions() {
  const [options, setOptions] = useState<Options | null>(null);
  useEffect(() => {
    actions.rpc('admin_options').then(({ data }) => setOptions((data ?? null) as Options | null));
  }, []);
  return options;
}

const mayAdminAll = (mine: string[]) => mine.includes('*');

// A strong temporary password the Super Admin can read out or write down.
function makeTemporaryPassword(): string {
  const words = ['Hangar', 'Rotor', 'Pitot', 'Rudder', 'Flap', 'Spoiler', 'Elevon', 'Aileron', 'Torque', 'Bleed'];
  const n = crypto.getRandomValues(new Uint32Array(3));
  return `${words[n[0] % words.length]}-${words[n[1] % words.length]}-${100 + (n[2] % 900)}`;
}

// ------------------------------------------------------------ users list
export function AdminUsers() {
  const { me } = useAuth();
  const [rows, setRows] = useState<PersonRow[] | null>(null);
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'pending' | 'active' | 'deactivated'>('all');

  useEffect(() => {
    actions.rpc('admin_people').then(({ data }) => setRows((data ?? []) as PersonRow[]));
  }, []);

  const shown = useMemo(() => (rows ?? []).filter((r) => {
    if (show !== 'all' && r.status !== show) return false;
    const t = q.trim().toLowerCase();
    return !t || [r.full_name, r.three_letter_code, r.username ?? ''].some((x) => x.toLowerCase().includes(t));
  }), [rows, q, show]);
  const pending = (rows ?? []).filter((r) => r.status === 'pending');

  if (!me?.adminDepartments?.length) return <NotAdmin />;

  return (
    <div className="page">
      <Crumbs items={[{ label: 'Administration' }, { label: 'Users and roles' }]} />
      <PageHead title="Users and roles"
        sub={mayAdminAll(me.adminDepartments) ? 'Super Admin for all departments (D-035)' : `Super Admin for ${me.adminDepartments.map((c) => me.allDepartments.find((d) => d.code === c)?.name ?? c).join(', ')} (D-035)`}>
        <Link className="button" to="/admin/users/new">Create account</Link>
      </PageHead>

      {pending.length > 0 && (
        <Section title={`Account requests waiting (${pending.length})`} tone="strong">
          <p className="small muted" style={{ margin: 0 }}>
            A person who asked for an account has no rights until you approve it (D-123). Open the request to approve or refuse it.
          </p>
          <table className="ptable">
            <thead><tr><th>Name</th><th>3LC</th><th>Username</th><th>Asked for</th><th>Asked on</th></tr></thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.person_id}>
                  <td><Link to={`/admin/users/${r.person_id}`}>{r.full_name}</Link></td>
                  <td className="mono">{r.three_letter_code}</td>
                  <td className="mono">{r.username}</td>
                  <td>{r.requested_department ?? '—'}</td>
                  <td>{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="People">
        <div className="action-row">
          <input aria-label="Find a person" placeholder="Name, 3LC or username" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
          <select aria-label="Which accounts" value={show} onChange={(e) => setShow(e.target.value as typeof show)} style={{ maxWidth: 220 }}>
            <option value="all">All accounts</option>
            <option value="active">Active</option>
            <option value="pending">Requests waiting</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
        {!rows ? <p className="muted">Loading…</p> : (
          <div className="table-scroll">
            <table className="ptable">
              <thead><tr><th>Name</th><th>3LC</th><th>Username</th><th>Departments</th><th>Aircraft scope</th><th>Account</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.person_id}>
                    <td><Link to={`/admin/users/${r.person_id}`}>{r.full_name}</Link>{r.rank_or_title && <div className="small muted">{r.rank_or_title}</div>}</td>
                    <td className="mono">{r.three_letter_code}</td>
                    <td className="mono">{r.username ?? '—'}</td>
                    <td>{r.departments ?? <span className="muted">None</span>}</td>
                    <td>{r.scope ?? <span className="muted">No aircraft</span>}</td>
                    <td>
                      <span className={`chip ${STATUS_CHIP[r.status] ?? 'tone-grey'}`}>{STATUS_TEXT[r.status] ?? r.status}</span>
                      {r.must_change_password && <div className="small muted">Temporary password</div>}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} className="muted">No one matches.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function NotAdmin() {
  return (
    <div className="page">
      <Section title="Users and roles">
        <p>Only a Super Admin can manage accounts (D-123). Ask your department CO.</p>
      </Section>
    </div>
  );
}

// ------------------------------------------------- the access chooser
// One block per category. Each block can be used alone (account page) or
// all together (create account).
function DepartmentsField({ options, value, onChange, mine }: {
  options: Options; value: Access['departments']; onChange: (v: Access['departments']) => void; mine: string[];
}) {
  const homeChoices = options.departments.filter((d) => mayAdminAll(mine) || mine.includes(d.code));
  return (
    <>
      <label htmlFor="home-dept">Home department <span className="hint">(their left rail and fleet board follow it, D-124)</span></label>
      <select id="home-dept" value={value.home} onChange={(e) => onChange({ home: e.target.value, extra: value.extra.filter((x) => x !== e.target.value) })} style={{ maxWidth: 320 }}>
        <option value="">Choose…</option>
        {homeChoices.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
      </select>
      <div className="label">Extra departments <span className="hint">(optional; add their work areas)</span></div>
      <div className="tick-grid">
        {options.departments.filter((d) => d.code !== value.home).map((d) => (
          <label key={d.code} className="check">
            <input type="checkbox" checked={value.extra.includes(d.code)}
              onChange={(e) => onChange({ ...value, extra: e.target.checked ? [...value.extra, d.code] : value.extra.filter((x) => x !== d.code) })} />
            {d.name}
          </label>
        ))}
      </div>
    </>
  );
}

function PermissionsField({ options, value, onChange, departments }: {
  options: Options; value: string[]; onChange: (v: string[]) => void; departments: string[];
}) {
  const quality = departments.includes('QUA');
  const list = options.permissions.filter((p) => !p.department || departments.includes(p.department));
  return (
    <>
      <div className="tick-grid">
        {list.map((p) => {
          const blocked = p.code === 'VIEW_COST' && quality;
          return (
            <label key={p.code} className="check" title={blocked ? 'Quality never sees cost (D-127)' : undefined}>
              <input type="checkbox" disabled={blocked} checked={value.includes(p.code)}
                onChange={(e) => onChange(e.target.checked ? [...value, p.code] : value.filter((x) => x !== p.code))} />
              {p.name}{p.department ? <span className="small muted"> · {options.departments.find((d) => d.code === p.department)?.name}</span> : null}
              {blocked && <span className="small muted"> · not for Quality (D-127)</span>}
            </label>
          );
        })}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Only permissions for the departments chosen appear. Belonging to a department does not grant them (D-121).</p>
    </>
  );
}

function ScopeField({ options, value, onChange }: { options: Options; value: Scope; onChange: (v: Scope) => void }) {
  return (
    <>
      <div className="action-row">
        {([['all', 'All aircraft'], ['types', 'By type'], ['tails', 'Pick tails'], ['none', 'No aircraft']] as const).map(([k, label]) => (
          <label key={k} className="check" style={{ marginRight: 12 }}>
            <input type="radio" name="scope-kind" checked={value.kind === k} onChange={() => onChange({ ...value, kind: k })} />
            {label}
          </label>
        ))}
      </div>
      {value.kind === 'types' && (
        <div className="tick-grid">
          {options.types.map((t) => (
            <label key={t.code} className="check">
              <input type="checkbox" checked={value.types.includes(t.code)}
                onChange={(e) => onChange({ ...value, types: e.target.checked ? [...value.types, t.code] : value.types.filter((x) => x !== t.code) })} />
              {t.name} <span className="small muted mono">{t.code}</span>
            </label>
          ))}
        </div>
      )}
      {value.kind === 'tails' && (
        <div className="tick-grid">
          {options.aircraft.map((a) => (
            <label key={a.id} className="check">
              <input type="checkbox" checked={value.tails.includes(a.id)}
                onChange={(e) => onChange({ ...value, tails: e.target.checked ? [...value.tails, a.id] : value.tails.filter((x) => x !== a.id) })} />
              <span className="mono">{a.tail}</span> <span className="small muted">{a.type}</span>
            </label>
          ))}
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>By type includes tails of that type added later. Pick tails gives only the tails ticked (D-121).</p>
    </>
  );
}

function TickList({ items, value, onChange, note }: { items: Option[]; value: string[]; onChange: (v: string[]) => void; note?: string }) {
  return (
    <>
      <div className="tick-grid">
        {items.map((s) => (
          <label key={s.code} className="check">
            <input type="checkbox" checked={value.includes(s.code)}
              onChange={(e) => onChange(e.target.checked ? [...value, s.code] : value.filter((x) => x !== s.code))} />
            {s.name}
          </label>
        ))}
      </div>
      {note && <p className="small muted" style={{ margin: 0 }}>{note}</p>}
    </>
  );
}

function AccessBlock({ category, options, access, setAccess, mine }: {
  category: Category; options: Options; access: Access; setAccess: (a: Access) => void; mine: string[];
}) {
  const depts = [access.departments.home, ...access.departments.extra].filter(Boolean);
  switch (category) {
    case 'departments':
      return <DepartmentsField options={options} value={access.departments} mine={mine} onChange={(v) => setAccess({ ...access, departments: v })} />;
    case 'permissions':
      return <PermissionsField options={options} value={access.permissions} departments={depts} onChange={(v) => setAccess({ ...access, permissions: v })} />;
    case 'scope':
      return <ScopeField options={options} value={access.scope} onChange={(v) => setAccess({ ...access, scope: v })} />;
    case 'stores':
      return <TickList items={options.stores} value={access.stores} onChange={(v) => setAccess({ ...access, stores: v })}
        note="Stores search and transfers show only the stores ticked here (D-152)." />;
    case 'sections':
      return depts.includes('ENG')
        ? <TickList items={options.sections} value={access.sections} onChange={(v) => setAccess({ ...access, sections: v })}
            note="Only ticked sections appear in the person's left rail (D-018)." />
        : <p className="small muted" style={{ margin: 0 }}>Engineering sections need the Engineering department.</p>;
  }
}

// What the database expects for each category.
function payload(category: Category, a: Access): Json {
  switch (category) {
    case 'departments': return { home: a.departments.home, extra: a.departments.extra };
    case 'scope': return a.scope.kind === 'all' ? { kind: 'all' }
      : a.scope.kind === 'types' ? { kind: 'types', types: a.scope.types }
      : a.scope.kind === 'tails' ? { kind: 'tails', tails: a.scope.tails } : { kind: 'none' };
    default: return a[category];
  }
}

const CATEGORY_TITLE: Record<Category, string> = {
  departments: 'Departments', permissions: 'Permissions within each department', scope: 'Aircraft scope',
  stores: 'Store access', sections: 'Engineering sections',
};

// Reason and PIN: needed for every Super Admin change (D-033, D-219).
function SignOff({ reason, setReason, pin, setPin, idPrefix }: {
  reason: string; setReason: (v: string) => void; pin: string; setPin: (v: string) => void; idPrefix: string;
}) {
  return (
    <>
      <label htmlFor={`${idPrefix}-reason`}>Reason <span className="hint">(required; goes in the change log)</span></label>
      <input id={`${idPrefix}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. New posting, covering leave roster" />
      <PinField id={`${idPrefix}-pin`} value={pin} onChange={setPin} />
    </>
  );
}

// ----------------------------------------------------------- create account
export function AdminCreateAccount() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const options = useOptions();
  const mine = me?.adminDepartments ?? [];
  const [fullName, setFullName] = useState('');
  const [rank, setRank] = useState('');
  const [tlc, setTlc] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(makeTemporaryPassword);
  const [access, setAccess] = useState<Access>({ ...EMPTY, departments: { home: mine.length === 1 && mine[0] !== '*' ? mine[0] : '', extra: [] } });
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!mine.length) return <NotAdmin />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) return setError('Enter the person\'s full name.');
    if (!/^[A-Za-z]{3}$/.test(tlc)) return setError('The 3LC is three letters (D-162).');
    if (!isValidUsername(username)) return setError('A username is 3 to 32 letters, numbers, dots, dashes or underscores.');
    if (!access.departments.home) return setError('Choose a home department.');
    if (!reason.trim()) return setError('Give a reason.');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN to confirm.');
    setBusy(true);
    const body: { [k: string]: Json } = {};
    (['departments', 'permissions', 'sections', 'scope', 'stores'] as Category[]).forEach((c) => { body[c] = payload(c, access); });
    const { data, error: err } = await actions.rpc('admin_create_account', {
      p_full_name: fullName.trim(), p_rank_or_title: rank.trim(), p_three_letter_code: tlc.toUpperCase(),
      p_username: username.trim().toLowerCase(), p_temporary_password: password, p_access: body,
      p_reason: reason.trim(), p_pin: pin,
    });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    // The temporary password travels in memory only, never in the address (browser history).
    navigate(`/admin/users/${data as string}`, { state: { created: username.trim().toLowerCase(), temp: password } });
  }

  return (
    <div className="page">
      <Crumbs items={[{ label: 'Administration' }, { label: 'Users and roles', to: '/admin/users' }, { label: 'Create account' }]} />
      <BackButton to="/admin/users" label="Users and roles" />
      <PageHead title="Create account" sub="Super Admins only · the person cannot change their own departments or access later (D-123)" />
      {!options ? <p className="muted">Loading…</p> : (
        <form onSubmit={submit} className="admin-form">
          <Section title="Person">
            <div className="row">
              <div><label htmlFor="ca-name">Full name</label><input id="ca-name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><label htmlFor="ca-rank">Rank or title <span className="hint">(optional)</span></label><input id="ca-rank" value={rank} onChange={(e) => setRank(e.target.value)} /></div>
            </div>
            <div className="row">
              <div><label htmlFor="ca-tlc">3LC <span className="hint">(three letters, unique, printed on sheets)</span></label>
                <input id="ca-tlc" className="mono" maxLength={3} value={tlc} onChange={(e) => setTlc(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} /></div>
              <div><label htmlFor="ca-user">Username <span className="hint">(used to sign in)</span></label>
                <input id="ca-user" className="mono" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. kdo.eng" /></div>
            </div>
            <label htmlFor="ca-pass">Temporary password <span className="hint">(give it to the person; they set their own at first sign-in, D-219)</span></label>
            <div className="row">
              <input id="ca-pass" className="mono" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="outline-button" style={{ flex: '0 0 auto' }} onClick={() => setPassword(makeTemporaryPassword())}>New one</button>
            </div>
          </Section>
          {(['departments', 'permissions', 'scope', 'stores', 'sections'] as Category[]).map((c) => (
            <Section key={c} title={CATEGORY_TITLE[c]}>
              <AccessBlock category={c} options={options} access={access} setAccess={setAccess} mine={mine} />
            </Section>
          ))}
          <Section title="Privileges">
            <p className="small" style={{ margin: 0 }}>
              Certifying privileges are not granted here. Quality issues them and the CO or ECO approves (D-032).
              Super Admin and approval steps follow appointments, not accounts (D-036).
            </p>
          </Section>
          <Section title="Confirm" tone="strong">
            <SignOff reason={reason} setReason={setReason} pin={pin} setPin={setPin} idPrefix="ca" />
            {error && <div className="error" role="alert">{error}</div>}
            <div className="action-row">
              <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
              <Link to="/admin/users" className="button outline-button">Cancel</Link>
            </div>
            <p className="small muted" style={{ margin: 0 }}>Recorded in the account change log with your name and time (D-033).</p>
          </Section>
        </form>
      )}
    </div>
  );
}

// ------------------------------------------------------------- account page
type Grant = {
  grant_type: string; department_code: string | null; is_home: boolean; permission_code: string | null;
  section_code: string | null; aircraft_type_code: string | null; aircraft_id: string | null; store_code: string | null;
};
type EventRow = { id: string; what: string; from_value: string | null; to_value: string | null; reason: string; done_at: string; who: { three_letter_code: string; full_name: string } | null };

function accessFromGrants(grants: Grant[]): Access {
  const a: Access = JSON.parse(JSON.stringify(EMPTY));
  for (const g of grants) {
    if (g.grant_type === 'department') {
      if (g.is_home) a.departments.home = g.department_code!; else a.departments.extra.push(g.department_code!);
    } else if (g.grant_type === 'permission') a.permissions.push(g.permission_code!);
    else if (g.grant_type === 'section') a.sections.push(g.section_code!);
    else if (g.grant_type === 'store') a.stores.push(g.store_code!);
    else if (g.grant_type === 'all_aircraft') a.scope.kind = 'all';
    else if (g.grant_type === 'aircraft_type') { if (a.scope.kind !== 'all') a.scope.kind = 'types'; a.scope.types.push(g.aircraft_type_code!); }
    else if (g.grant_type === 'aircraft') { if (a.scope.kind === 'none') a.scope.kind = 'tails'; a.scope.tails.push(g.aircraft_id!); }
  }
  return a;
}

export function AdminAccount() {
  const { personId = '' } = useParams();
  const location = useLocation();
  const { me, display } = useAuth();
  const options = useOptions();
  const [person, setPerson] = useState<PersonRow | null | undefined>(undefined);
  const [access, setAccess] = useState<Access>(EMPTY);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [message, setMessage] = useState('');
  const { created, temp } = (location.state ?? {}) as { created?: string; temp?: string };

  const load = useCallback(async () => {
    const [{ data: people }, { data: grants }, { data: ev }] = await Promise.all([
      actions.rpc('admin_people'),
      db.from('access_grant').select('grant_type, department_code, is_home, permission_code, section_code, aircraft_type_code, aircraft_id, store_code')
        .eq('person_id', personId).is('revoked_at', null),
      db.from('account_event').select('id, what, from_value, to_value, reason, done_at, who:done_by (three_letter_code, full_name)')
        .eq('person_id', personId).order('done_at', { ascending: false }),
    ]);
    setPerson(((people ?? []) as PersonRow[]).find((p) => p.person_id === personId) ?? null);
    setAccess(accessFromGrants((grants ?? []) as Grant[]));
    setEvents((ev ?? []) as unknown as EventRow[]);
  }, [personId]);
  useEffect(() => { load(); }, [load]);

  if (!me?.adminDepartments?.length) return <NotAdmin />;
  if (person === undefined || !options) return <div className="page muted">Loading…</div>;
  if (person === null) return <div className="page"><p>This person is not one you look after as Super Admin (D-035).</p></div>;
  const own = person.person_id === me.personId;
  const done = (m: string) => { setMessage(m); load(); };

  return (
    <div className="page">
      <Crumbs items={[{ label: 'Administration' }, { label: 'Users and roles', to: '/admin/users' }, { label: person.full_name }]} />
      <BackButton to="/admin/users" label="Users and roles" />
      <PageHead title={person.full_name}
        sub={<>{person.rank_or_title ? `${person.rank_or_title} · ` : ''}3LC <span className="mono">{person.three_letter_code}</span> · username <span className="mono">{person.username ?? '—'}</span> · <span className={`chip ${STATUS_CHIP[person.status] ?? 'tone-grey'}`}>{STATUS_TEXT[person.status] ?? person.status}</span></>} />

      {created && temp && (
        <div className="success" role="status">
          Account created. Give <strong className="mono">{created}</strong> this temporary password: <strong className="mono">{temp}</strong>.
          They set their own password and PIN at first sign-in (D-219). It is not shown again.
        </div>
      )}
      {message && <div className="success" role="status">{message}</div>}
      {own && <div className="notice">This is your own account. Nobody can change their own account (D-033); ask another Super Admin.</div>}

      {person.status === 'pending' && !own && (
        <StatusBox person={person} onDone={done} kind="request" />
      )}

      {(['departments', 'permissions', 'scope', 'stores', 'sections'] as Category[]).map((c) => (
        <AccessSection key={c} category={c} person={person} options={options} access={access} mine={me.adminDepartments} disabled={own || person.status === 'pending'} onDone={done} />
      ))}

      {person.status !== 'pending' && !own && <StatusBox person={person} onDone={done} kind="status" />}
      {person.status === 'active' && !own && <PasswordBox person={person} onDone={done} />}

      <Section title="Change log">
        <div className="table-scroll">
          <table className="ptable">
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>From</th><th>To</th><th>Why</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{formatDateTime(e.done_at, display)}</td>
                  <td className="mono">{e.who?.three_letter_code ?? '—'}</td>
                  <td>{e.what}</td>
                  <td>{e.from_value ?? '—'}</td>
                  <td>{e.to_value ?? '—'}</td>
                  <td>{e.reason}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={6} className="muted">No changes recorded through this screen yet (accounts loaded at set-up have none).</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Entries are never edited or deleted (D-023).</p>
      </Section>
    </div>
  );
}

// One category on the account page: what they have now, and "Change".
function AccessSection({ category, person, options, access, mine, disabled, onDone }: {
  category: Category; person: PersonRow; options: Options; access: Access; mine: string[]; disabled: boolean; onDone: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Access>(access);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!editing) setDraft(access); }, [access, editing]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (category === 'departments' && !draft.departments.home) return setError('Choose a home department.');
    if (!reason.trim()) return setError('Give a reason for the change.');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN to confirm.');
    setBusy(true);
    const { error: err } = await actions.rpc('admin_set_access', {
      p_person: person.person_id, p_category: category, p_values: payload(category, draft), p_reason: reason.trim(), p_pin: pin,
    });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    setEditing(false);
    setReason('');
    onDone(`${CATEGORY_TITLE[category]} changed for ${person.full_name}. Recorded in the change log.`);
  }

  return (
    <Section title={CATEGORY_TITLE[category]}
      actions={!disabled && !editing && <button type="button" className="outline-button" onClick={() => setEditing(true)}>Change</button>}>
      {!editing ? <CurrentAccess category={category} access={access} options={options} /> : (
        <form onSubmit={save} className="admin-change">
          <AccessBlock category={category} options={options} access={draft} setAccess={setDraft} mine={mine} />
          <SignOff reason={reason} setReason={setReason} pin={pin} setPin={setPin} idPrefix={`chg-${category}`} />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="action-row">
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save change'}</button>
            <button type="button" className="outline-button" onClick={() => { setEditing(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      )}
    </Section>
  );
}

function CurrentAccess({ category, access, options }: { category: Category; access: Access; options: Options }) {
  const name = (list: Option[], code: string) => list.find((x) => x.code === code)?.name ?? code;
  let body: ReactNode;
  switch (category) {
    case 'departments':
      body = access.departments.home
        ? <>Home: <strong>{name(options.departments, access.departments.home)}</strong>{access.departments.extra.length > 0 && <> · Extra: {access.departments.extra.map((d) => name(options.departments, d)).join(', ')}</>}</>
        : 'None';
      break;
    case 'permissions': body = access.permissions.map((p) => name(options.permissions, p)).join(' · ') || 'None'; break;
    case 'sections': body = access.sections.map((s) => name(options.sections, s)).join(' · ') || 'None'; break;
    case 'stores': body = access.stores.map((s) => name(options.stores, s)).join(' · ') || 'None'; break;
    case 'scope':
      body = access.scope.kind === 'all' ? `All aircraft (${options.aircraft.length})`
        : access.scope.kind === 'types' ? `By type: ${access.scope.types.join(', ')}`
        : access.scope.kind === 'tails' ? access.scope.tails.map((id) => options.aircraft.find((a) => a.id === id)?.tail ?? id).join(', ')
        : 'No aircraft';
  }
  return <div>{body}</div>;
}

// Approve or refuse a request; deactivate or reactivate an account (D-030, D-123).
function StatusBox({ person, onDone, kind }: { person: PersonRow; onDone: (m: string) => void; kind: 'request' | 'status' }) {
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function set(status: 'active' | 'deactivated') {
    setError('');
    if (!reason.trim()) return setError(status === 'deactivated' && kind === 'request' ? 'Give a reason for refusing.' : 'Give a reason.');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN to confirm.');
    setBusy(true);
    const { error: err } = await actions.rpc('admin_set_status', { p_person: person.person_id, p_status: status, p_reason: reason.trim(), p_pin: pin });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    setReason('');
    onDone(kind === 'request'
      ? (status === 'active' ? `Request approved. ${person.full_name} can sign in; set their permissions and aircraft scope below.` : 'Request refused.')
      : (status === 'active' ? 'Account reactivated.' : 'Account deactivated. Their records stay attached to their name (D-030).'));
  }
  const title = kind === 'request' ? `Account request · asked for ${person.requested_department ?? '—'}` : 'Account';
  return (
    <Section title={title} tone={kind === 'request' ? 'strong' : undefined}>
      {kind === 'request'
        ? <p className="small" style={{ margin: 0 }}>Approving makes the account active with {person.requested_department ?? 'the requested department'} as home department. Then set permissions and aircraft scope (D-123).</p>
        : <p className="small" style={{ margin: 0 }}>{person.status === 'active' ? 'Active.' : 'Deactivated.'} Accounts are deactivated, never deleted (D-030).</p>}
      <SignOff reason={reason} setReason={setReason} pin={pin} setPin={setPin} idPrefix={`st-${kind}`} />
      {error && <div className="error" role="alert">{error}</div>}
      <div className="action-row">
        {kind === 'request' && <>
          <button type="button" disabled={busy} onClick={() => set('active')}>Approve</button>
          <button type="button" className="outline-button" disabled={busy} onClick={() => set('deactivated')}>Refuse</button>
        </>}
        {kind === 'status' && person.status === 'active' && <button type="button" className="outline-button danger-button" disabled={busy} onClick={() => set('deactivated')}>Deactivate account</button>}
        {kind === 'status' && person.status === 'deactivated' && <button type="button" disabled={busy} onClick={() => set('active')}>Reactivate account</button>}
      </div>
    </Section>
  );
}

// Forgotten password: the Super Admin sets a temporary one (D-219).
function PasswordBox({ person, onDone }: { person: PersonRow; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(makeTemporaryPassword);
  const [reason, setReason] = useState('Forgotten password');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!reason.trim()) return setError('Give a reason.');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN to confirm.');
    setBusy(true);
    const { error: err } = await actions.rpc('admin_reset_password', { p_person: person.person_id, p_temporary_password: password, p_reason: reason.trim(), p_pin: pin });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    setOpen(false);
    onDone(`Temporary password for ${person.username}: ${password} — give it to them; they set their own at next sign-in. It is not shown again. Their PIN is not affected.`);
    setPassword(makeTemporaryPassword());
  }
  return (
    <Section title="Password" actions={!open && <button type="button" className="outline-button" onClick={() => setOpen(true)}>Reset password</button>}>
      {!open ? <p className="small" style={{ margin: 0 }}>{person.must_change_password ? 'Temporary password set; the person has not chosen their own yet.' : 'The person has set their own password.'} Passwords are reset by a Super Admin, never by the user alone. The PIN is separate and not affected.</p> : (
        <form onSubmit={submit}>
          <label htmlFor="rp-pass">Temporary password</label>
          <div className="row">
            <input id="rp-pass" className="mono" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="outline-button" style={{ flex: '0 0 auto' }} onClick={() => setPassword(makeTemporaryPassword())}>New one</button>
          </div>
          <SignOff reason={reason} setReason={setReason} pin={pin} setPin={setPin} idPrefix="rp" />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="action-row">
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set temporary password'}</button>
            <button type="button" className="outline-button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </Section>
  );
}
