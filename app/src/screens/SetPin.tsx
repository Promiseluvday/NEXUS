// First sign-in: set the signing PIN (D-094, D-206).
// The PIN is re-entered to sign anything (certify, apply MEL, confirm NADD).
// The database stores only a one-way hash of it, never the PIN itself.
// Also: the "account waiting for approval" page (D-123).
import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { actions, errorText } from '../lib/supabase';

export function SetPin() {
  const { me, reload, signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('A PIN is 4 to 8 digits.');
    if (pin !== again) return setError('The two PINs do not match.');
    setBusy(true);
    const { error: err } = await actions.rpc('set_my_pin', { p_pin: pin });
    setBusy(false);
    if (err) return setError(errorText(err));
    await reload();
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">N</span> Nexus MRO
        </div>
        <h1>Set your signing PIN</h1>
        <p className="muted">
          Welcome, {me?.fullName} (<span className="mono">{me?.tlc}</span>). You will enter this PIN each time you sign
          for work. Keep it to yourself.
        </p>
        <label htmlFor="pin">PIN <span className="hint">(4 to 8 digits)</span></label>
        <input id="pin" type="password" inputMode="numeric" autoComplete="new-password"
          value={pin} onChange={(e) => setPin(e.target.value)} required />
        <label htmlFor="pin2">PIN again</label>
        <input id="pin2" type="password" inputMode="numeric" autoComplete="new-password"
          value={again} onChange={(e) => setAgain(e.target.value)} required />
        {error && <div className="error" role="alert">{error}</div>}
        <p className="row">
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save PIN'}</button>
          <button type="button" className="plain" onClick={signOut}>Sign out</button>
        </p>
      </form>
    </div>
  );
}

export function AccountNotActive() {
  const { me, signOut } = useAuth();
  const pending = me?.status === 'pending';
  return (
    <div className="center">
      <div className="card narrow">
        <div className="brand">
          <span className="brand-mark">N</span> Nexus MRO
        </div>
        <h1>{pending ? 'Account waiting for approval' : 'Account not active'}</h1>
        <p>
          {pending
            ? 'A Super Admin of the department you asked for must approve your account before you can use Nexus.'
            : 'This account has been deactivated. Speak to your department Super Admin.'}
        </p>
        <button type="button" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
