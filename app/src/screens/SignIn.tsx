// Sign in with a username or email and a password (D-206).
// Layout from the Claude Design canvas (Login.dc.html). Also: request an
// account (D-206), which stays pending until a Super Admin approves (D-123).
import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { configMissing } from '../lib/supabase';

export function SignIn() {
  const { signIn } = useAuth();
  const [requesting, setRequesting] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const problem = await signIn(username, password);
    if (problem) setError(problem);
    setBusy(false);
  }

  return (
    <div className="login">
      <div className="login-panel">
        <div className="login-brand">
          <div className="crest" aria-hidden>Operator crest</div>
          <div>
            <div className="brand-name login-name">Nexus<span> MRO</span></div>
            <div className="brand-by">by Liebetag</div>
          </div>
        </div>
        <div className="login-pitch">
          <div className="login-line">One record for every aircraft.</div>
          <p>Engineering, Supply, Procurement and Operations work from the same aircraft status. Command and Quality approve and audit.</p>
        </div>
        <div className="login-foot">Authorised users only · every sign-in is logged.</div>
      </div>
      <div className="login-side">
        {requesting ? <RequestAccount onBack={() => setRequesting(false)} /> : (
        <form className="login-card" onSubmit={submit}>
          <h1>Sign in</h1>
          {configMissing && (
            <div className="error">
              The app is not connected to a database. Run <span className="mono">npm run env:local</span>, then restart{' '}
              <span className="mono">npm run dev</span>.
            </div>
          )}
          <label htmlFor="username">Username or email</label>
          <input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <label htmlFor="password">Password</label>
          <div className="row">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="outline-button" style={{ flex: '0 0 auto' }}
              aria-label="Show or hide password" onClick={() => setShowPw((v) => !v)}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" className="login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="login-note">
            Forgotten password: your department Super Admin resets it (D-033). Your PIN is not affected.
            On a shared terminal, sign out when you leave.
          </p>
          <button type="button" className="link-button" onClick={() => setRequesting(true)}>Request an account</button>
        </form>
        )}
      </div>
    </div>
  );
}

// The product's departments (D-015). A Super Admin of the one chosen approves.
const DEPARTMENTS = [
  ['ENG', 'Engineering'], ['OPS', 'Operations'], ['SUP', 'Supply'], ['PRO', 'Procurement'], ['QUA', 'Quality'], ['CMD', 'Command'],
];

function RequestAccount({ onBack }: { onBack: () => void }) {
  const { requestAccount } = useAuth();
  const [f, setF] = useState({ fullName: '', rank: '', username: '', tlc: '', department: 'ENG', password: '', again: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!f.fullName.trim()) return setError('Enter your full name.');
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(f.username.trim().toLowerCase())) return setError('A username is 3 to 32 letters, numbers, dots, dashes or underscores.');
    if (!/^[A-Za-z]{3}$/.test(f.tlc)) return setError('Your 3LC is three letters.');
    if (f.password.length < 8) return setError('A password needs at least 8 characters.');
    if (f.password !== f.again) return setError('The two passwords do not match.');
    setBusy(true);
    const problem = await requestAccount({ ...f });
    setBusy(false);
    if (problem) setError(problem);
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <h1>Request an account</h1>
      <p className="small muted" style={{ marginTop: 0 }}>
        A Super Admin of the department you choose confirms your department, permissions and aircraft before the account works (D-123).
      </p>
      <label htmlFor="rq-name">Full name</label>
      <input id="rq-name" value={f.fullName} onChange={set('fullName')} />
      <label htmlFor="rq-rank">Rank or title <span className="hint">(optional)</span></label>
      <input id="rq-rank" value={f.rank} onChange={set('rank')} />
      <div className="row">
        <div><label htmlFor="rq-user">Username you would like</label>
          <input id="rq-user" autoCapitalize="none" spellCheck={false} value={f.username} onChange={set('username')} placeholder="e.g. kdo.eng" /></div>
        <div><label htmlFor="rq-tlc">3LC</label>
          <input id="rq-tlc" className="mono" maxLength={3} value={f.tlc} onChange={(e) => setF({ ...f, tlc: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} /></div>
      </div>
      <label htmlFor="rq-dept">Department you are requesting</label>
      <select id="rq-dept" value={f.department} onChange={set('department')}>
        {DEPARTMENTS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select>
      <div className="row">
        <div><label htmlFor="rq-pass">Password</label>
          <input id="rq-pass" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></div>
        <div><label htmlFor="rq-pass2">Password again</label>
          <input id="rq-pass2" type="password" autoComplete="new-password" value={f.again} onChange={set('again')} /></div>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" className="login-submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
      <button type="button" className="link-button" onClick={onBack}>← Back to sign in</button>
    </form>
  );
}
