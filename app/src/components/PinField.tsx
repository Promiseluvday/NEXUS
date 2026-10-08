// The signing step (D-094): re-enter your PIN to sign.
// Always shown on the screen being signed, never tucked away
// (docs/ui-rules.md). The database checks the PIN against its one-way hash;
// the screen never stores it.
type Props = { value: string; onChange: (pin: string) => void; id?: string };

export function PinField({ value, onChange, id = 'sign-pin' }: Props) {
  return (
    <div className="sign-box">
      <label htmlFor={id}>Sign with your PIN</label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        required
      />
      <div className="small muted">Your PIN signs this entry in your name, with the server time.</div>
    </div>
  );
}
