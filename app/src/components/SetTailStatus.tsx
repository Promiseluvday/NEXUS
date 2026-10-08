// Set the tail status (D-046): engineers only, with a reason, signed with the
// PIN (D-215). The status is what the ENGINEER decides; Nexus records it with
// their name and the server time. Nothing here works it out (D-020).
// Expected return to service is optional (D-047).
import { useState, type FormEvent } from 'react';
import { actions, errorText } from '../lib/supabase';
import { TAIL_STATUS } from './StatusChip';
import { DateField } from './DateField';
import { PinField } from './PinField';

type Props = { aircraftId: string; tail: string; current: string | null; onDone: () => void };

export function SetTailStatus({ aircraftId, tail, current, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(current ?? '');
  const [reason, setReason] = useState('');
  const [rts, setRts] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!status) return setError('Choose a status.');
    if (!reason.trim()) return setError('Give the reason for the status.');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN (4 to 8 digits) to sign.');
    setBusy(true);
    const { error: err } = await actions.rpc('set_tail_status', {
      p_aircraft: aircraftId, p_status: status, p_reason: reason.trim(), p_pin: pin,
      p_expected_rts: rts || undefined,
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    setOpen(false);
    setReason('');
    setRts('');
    setPin('');
    onDone();
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)}>Set tail status…</button>;
  }

  return (
    <form className="card inset" onSubmit={submit}>
      <h2>Set status of <span className="mono">{tail}</span></h2>
      <label htmlFor="tail-status">Status</label>
      <select id="tail-status" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Choose…</option>
        {Object.entries(TAIL_STATUS).map(([code, s]) => (
          <option key={code} value={code}>{s.long}</option>
        ))}
      </select>
      <label htmlFor="tail-reason">Reason</label>
      <input id="tail-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
      {(status === 'US' || status === 'AOG' || status === 'IN_CHECK') && (
        <>
          <label htmlFor="tail-rts">Expected return to service <span className="hint">(optional)</span></label>
          <DateField id="tail-rts" value={rts} onChange={setRts} />
        </>
      )}
      <PinField id="tail-pin" value={pin} onChange={setPin} />
      {error && <div className="error" role="alert">{error}</div>}
      <p className="row">
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Sign and set status'}</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
      </p>
    </form>
  );
}
