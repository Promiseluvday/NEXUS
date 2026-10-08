// Sign in with a username or email and a password (D-206).
// Requesting an account and "forgot password" come in a later slice.
import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { configMissing } from '../lib/supabase';

export function SignIn() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const problem = await signIn(username, password);
    if (problem) setError(problem);
    setBusy(false);
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">N</span> Nexus MRO
        </div>
        <h1>Sign in</h1>
        {configMissing && (
          <div className="error">
            The app is not connected to a database. Copy <span className="mono">.env.example</span> to{' '}
            <span className="mono">.env.local</span> and fill it in (see README).
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
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error" role="alert">{error}</div>}
        <p>
          <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </p>
      </form>
    </div>
  );
}
