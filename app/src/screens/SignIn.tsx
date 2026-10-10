// Sign in with a username or email and a password (D-206).
// Layout from the Claude Design canvas (Login.dc.html). Requesting an
// account comes in a later slice.
import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { configMissing } from '../lib/supabase';

export function SignIn() {
  const { signIn } = useAuth();
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
        </form>
      </div>
    </div>
  );
}
