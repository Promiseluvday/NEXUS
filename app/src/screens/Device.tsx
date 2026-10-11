// This tablet and offline signing (D-217, Q-OS1: line tablets only).
//
//   1. Register this tablet (once, any signed-in user, online)
//   2. A Super Admin of Engineering enrols it (below, on their own screen)
//   3. Each engineer who may sign offline switches it on for themselves,
//      online, with a PIN of at least 6 digits
// Also here: change your PIN, and (Super Admins) enrol, revoke or report a
// tablet lost. Laid out in the shared page frame (breadcrumb, Back, heading,
// titled boxes), like the other Phase C screens.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import { useDevice, useOnline } from '../lib/offline/hooks';
import { checkIn, registerDevice } from '../lib/offline/device';
import { enableOfflineSigning, offlineSigningProblem } from '../lib/offline/signing';
import { BackButton, Crumbs, PageHead, Section } from '../components/PageFrame';

export function DevicePage() {
  const { me } = useAuth();
  const dev = useDevice();
  const online = useOnline();
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [signProblem, setSignProblem] = useState<string | null>('…');
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));

  const refresh = useCallback(async () => {
    if (me) setSignProblem(await offlineSigningProblem(me.userId));
  }, [me]);
  useEffect(() => { checkIn().then(refresh); }, [refresh]);
  useEffect(() => { refresh(); }, [dev, refresh]);

  async function register(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError('Give the tablet a name, e.g. "Line tablet 3, Hangar 2".');
    const problem = await registerDevice(label.trim());
    if (problem) return setError(errorText({ message: problem }));
    setError('');
    setMessage('Tablet registered. A Super Admin of Engineering must now enrol it.');
  }

  return (
    <div className="page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'This tablet' }]} />
      <BackButton to="/" label="All aircraft" />
      <PageHead title="This tablet and offline signing"
        sub={online ? 'Online' : 'Offline: registering, switching on and changing your PIN need a connection.'} />
      {message && <div className={/provisional|queued/.test(message) ? 'offline-banner' : 'success'} role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <Section title="This tablet">
        {!dev.deviceId ? (
          <form onSubmit={register}>
            <p className="small muted">Only line tablets enrolled by a Super Admin can sign offline (D-217). Phones can still report and view offline.</p>
            <label htmlFor="dev-label">Tablet name</label>
            <input id="dev-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Line tablet 3, Hangar 2" />
            <p><button type="submit" disabled={!online}>Register this tablet</button></p>
          </form>
        ) : (
          <dl className="facts">
            <dt>Name</dt><dd>{dev.label}</dd>
            <dt>Status</dt><dd>{dev.problem ? <span className="chip tone-amber">{dev.problem}</span> : <span className="chip tone-green">Enrolled</span>}</dd>
            <dt>Last contact</dt><dd>{dev.checkedAt ? formatDateTime(new Date(dev.checkedAt)) : 'not this session'}</dd>
            <dt>Offline limit</dt><dd>{dev.maxHours} hours without contact</dd>
          </dl>
        )}
      </Section>

      {isEngineer && dev.deviceId && (
        <Section title={<>Offline signing for {me?.fullName} <span className="mono">{me?.tlc}</span></>}>
          {signProblem === null
            ? <p><span className="chip tone-green">Ready</span> You can sign dispositions, clearances, certifications and tail status here without a connection. They stay provisional until the server checks them.</p>
            : <p className="small">{signProblem}</p>}
          {!dev.problem && <EnableSigning onDone={(m) => { setMessage(m); refresh(); }} />}
        </Section>
      )}

      <ChangePin onDone={setMessage} />

      {me && (me.departments.some((d) => d.code === 'ENG') || me.departments.some((d) => d.code === 'CMD')) && <DeviceAdmin />}
    </div>
  );
}

function EnableSigning({ onDone }: { onDone: (m: string) => void }) {
  const { me } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^[0-9]{6,8}$/.test(pin)) return setError('Offline signing needs a PIN of 6 to 8 digits. Change your PIN below first if it is shorter.');
    setBusy(true);
    const problem = await enableOfflineSigning(me!.userId, pin);
    setBusy(false);
    setPin('');
    if (problem) return setError(errorText({ message: problem }));
    onDone('Offline signing is switched on for you on this tablet.');
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="enable-pin">Switch on (or renew) with your PIN <span className="hint">(online, 6 to 8 digits)</span></label>
      <input id="enable-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={8} style={{ maxWidth: 220 }}
        value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} />
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Switching on…' : 'Switch on offline signing'}</button></p>
    </form>
  );
}

function ChangePin({ onDone }: { onDone: (m: string) => void }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('A PIN is 4 to 8 digits; 6 or more to sign offline.');
    if (pin !== again) return setError('The two PINs do not match.');
    const { error: err } = await actions.rpc('set_my_pin', { p_pin: pin });
    if (err) return setError(errorText(err));
    setPin('');
    setAgain('');
    onDone('PIN changed. If you sign offline, switch offline signing on again with the new PIN.');
  }
  return (
    <Section title="Change your PIN" id="pin">
      <form onSubmit={submit}>
        <div className="row">
          <div><label htmlFor="new-pin">New PIN</label>
            <input id="new-pin" type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} /></div>
          <div><label htmlFor="new-pin2">New PIN again</label>
            <input id="new-pin2" type="password" inputMode="numeric" maxLength={8} value={again} onChange={(e) => setAgain(e.target.value.replace(/[^0-9]/g, ''))} /></div>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <p><button type="submit">Change PIN</button></p>
      </form>
    </Section>
  );
}

type DeviceRow = {
  id: string; label: string; status: string; requested_at: string; enrolled_at: string | null;
  revoked_at: string | null; revoke_reason: string | null; reported_lost_at: string | null; blocked_at: string | null;
  last_seen_at: string | null; requester: { three_letter_code: string } | null;
};

// Super Admins of Engineering (and the Commander): enrol, revoke, report lost.
function DeviceAdmin() {
  const { display } = useAuth();
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data } = await db.from('device')
      .select('id, label, status, requested_at, enrolled_at, revoked_at, revoke_reason, reported_lost_at, blocked_at, last_seen_at, requester:requested_by (three_letter_code)')
      .order('requested_at', { ascending: false });
    setRows((data ?? []) as unknown as DeviceRow[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function enrol(id: string) {
    const { error: err } = await actions.rpc('enrol_device', { p_device: id });
    setError(err ? errorText(err) : '');
    load();
  }
  async function revoke(id: string, lost: boolean) {
    const reason = window.prompt(lost ? 'Report lost: what happened?' : 'Reason for revoking this tablet');
    if (!reason) return;
    const { error: err } = await actions.rpc('revoke_device', { p_device: id, p_reason: reason, p_lost: lost });
    setError(err ? errorText(err) : '');
    load();
  }
  if (rows.length === 0) return null;
  return (
    <Section title="Tablets (Super Admin)">
      {error && <div className="error" role="alert">{error}</div>}
      <table className="board sq-table">
        <thead><tr><th>Tablet</th><th>Status</th><th>Registered</th><th>Last contact</th><th aria-label="Actions" /></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td data-label="Tablet">{d.label}</td>
              <td data-label="Status">
                <span className={`chip tone-${d.status === 'enrolled' && !d.blocked_at ? 'green' : d.status === 'pending' ? 'blue' : 'red'}`}>
                  {d.reported_lost_at ? 'Reported lost' : d.blocked_at ? 'Blocked' : d.status === 'enrolled' ? 'Enrolled' : d.status === 'pending' ? 'Waiting' : 'Revoked'}
                </span>
                {d.revoke_reason && <div className="small muted">{d.revoke_reason}</div>}
              </td>
              <td data-label="Registered" className="small">{formatDateTime(d.requested_at, display)} · <span className="mono">{d.requester?.three_letter_code}</span></td>
              <td data-label="Last contact" className="small">{d.last_seen_at ? formatDateTime(d.last_seen_at, display) : '—'}</td>
              <td data-label=""><div className="action-row">
                {d.status === 'pending' && <button type="button" onClick={() => enrol(d.id)}>Enrol</button>}
                {d.status !== 'revoked' && <button type="button" className="outline-button" onClick={() => revoke(d.id, false)}>Revoke</button>}
                {d.status !== 'revoked' && <button type="button" className="outline-button" onClick={() => revoke(d.id, true)}>Report lost</button>}
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
