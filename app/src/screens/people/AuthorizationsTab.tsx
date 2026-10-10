// WF-O3 · Certifying authorizations (D-031, D-032, D-033, D-037, D-043).
//
//   Quality ISSUES (reference, aircraft type, valid from, expires on) with PIN
//   -> it waits for the CO or ECO (also in their Approvals inbox)
//   -> the CO or ECO APPROVES with PIN (or rejects with a reason)
//   -> it counts. Quality or the CO / ECO can REVOKE it with a reason.
// Nobody issues or approves their own; the issuer cannot also approve. Never
// deleted: rejected, withdrawn and revoked ones stay listed with who and why.
//
// "Can certify today" is what app.is_certifying() finds in the records: an
// approved authorization in date for the type, a current licence and a
// current type rating (D-043). Nexus records; licensed people decide (D-020).
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions, errorText } from '../../lib/supabase';
import { formatDateTime, formatPlainDate } from '../../lib/format';
import { Section } from '../../components/PageFrame';
import { PinField } from '../../components/PinField';
import { DateField } from '../../components/DateField';
import { loadAircraftTypes, pinLooksRight, type Authorization, type PersonRecordData } from './types';

function StateChip({ a }: { a: Authorization }) {
  const { display } = useAuth();
  const d = (v: string | null) => formatPlainDate(v ? v.slice(0, 10) : null, display);
  switch (a.state) {
    case 'pending': return <span className="chip tone-blue">Waiting for {a.waiting_step ?? 'CO / ECO approval'}</span>;
    case 'active': return <span className="chip tone-green">Approved by {a.approved_by} · {d(a.approved_at)}</span>;
    case 'approaching': return <span className="chip tone-amber">Approaching expiry · approved by {a.approved_by}</span>;
    case 'not_yet_valid': return <span className="chip tone-blue">Approved · valid from {d(a.valid_from)}</span>;
    case 'expired': return <span className="chip tone-red">Reached · expired</span>;
    case 'revoked': return <span className="chip tone-grey">Revoked by {a.revoked_by} · {d(a.revoked_at)}</span>;
    case 'rejected': return <span className="chip tone-grey">Rejected by {a.revoked_by} · {d(a.revoked_at)}</span>;
    case 'withdrawn': return <span className="chip tone-grey">Withdrawn by {a.revoked_by} · {d(a.revoked_at)}</span>;
  }
}

const OPEN_STATES = ['pending', 'active', 'approaching', 'not_yet_valid'];

export function AuthorizationsTab({ data, onDone }: { data: PersonRecordData; onDone: (m: string) => void }) {
  const [issuing, setIssuing] = useState(false);
  const live = data.authorizations.filter((a) => OPEN_STATES.includes(a.state) || a.state === 'expired');
  const closed = data.authorizations.filter((a) => !live.includes(a));

  // Why an approved, in-date authorization does not let the person certify
  // today: say which record is missing (D-043). Only when we can see them.
  const quals = (data.qualifications ?? []).filter((q) => !q.superseded_at);
  const today = data.today;
  const licenceOk = quals.some((q) => q.kind === 'licence' && (!q.expires_on || q.expires_on >= today));
  const ratingOk = (type: string) => quals.some((q) => q.kind === 'type_rating' && q.aircraft_type_code === type && (!q.expires_on || q.expires_on >= today));
  const blocked = data.authorizations
    .filter((a) => (a.state === 'active' || a.state === 'approaching') && !data.certifying_types.includes(a.aircraft_type_code))
    .map((a) => ({
      type: a.aircraft_type_code,
      why: data.qualifications === null ? 'licence or type rating not current'
        : [!licenceOk && 'no current licence', !ratingOk(a.aircraft_type_code) && `no current ${a.aircraft_type_code} type rating`].filter(Boolean).join(' and '),
    }));

  return (
    <>
      <Section title="Certifying authorizations"
        actions={data.can.issue && !issuing && <button type="button" className="outline-button" onClick={() => setIssuing(true)}>Issue authorization</button>}>
        <div className="action-row">
          <span className="small muted">Can certify today:</span>
          {data.certifying_types.length > 0
            ? data.certifying_types.map((t) => <span key={t} className="chip tone-green mono">{t}</span>)
            : <span className="chip tone-grey">None</span>}
        </div>
        {blocked.map((b) => (
          <div key={b.type} className="notice">
            The {b.type} authorization is approved, but the records show {b.why || 'a missing licence or rating'}, so certifying is refused until Quality records it (D-043).{' '}
            <Link to={`/people/${data.person.id}/qualifications`}>Licences, ratings, medicals</Link>
          </div>
        ))}
        <div className="table-scroll">
          <table className="ptable pp-table">
            <thead><tr><th>Authorization</th><th>Scope</th><th className="pp-hide-sm">Valid from</th><th>Expires</th><th>State</th></tr></thead>
            <tbody>
              {live.map((a) => <AuthRow key={a.id} a={a} data={data} onDone={onDone} />)}
              {live.length === 0 && <tr><td colSpan={5} className="muted">No current certifying authorization.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Scope is by aircraft type (D-032). Quality issues; the CO or ECO approves with PIN. Every step is logged with who and when (D-033).
        </p>
      </Section>

      {issuing && data.can.issue && <IssueForm data={data} onCancel={() => setIssuing(false)} onDone={(m) => { setIssuing(false); onDone(m); }} />}

      {closed.length > 0 && (
        <Section title={`Closed (${closed.length})`}>
          <div className="table-scroll">
            <table className="ptable pp-table">
              <thead><tr><th>Authorization</th><th>Scope</th><th>State</th><th>Reason</th></tr></thead>
              <tbody>
                {closed.map((a) => (
                  <tr key={a.id} className="pp-old">
                    <td className="mono">{a.reference}</td>
                    <td>{a.aircraft_type_code}</td>
                    <td><StateChip a={a} /></td>
                    <td>{a.revoke_reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Authorizations are never deleted (D-023): rejected, withdrawn and revoked ones stay here with who, when and why.</p>
        </Section>
      )}
    </>
  );
}

function AuthRow({ a, data, onDone }: { a: Authorization; data: PersonRecordData; onDone: (m: string) => void }) {
  const { display, me } = useAuth();
  const [open, setOpen] = useState<'' | 'decide' | 'revoke'>('');
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = a.state === 'pending';
  const iIssued = me?.tlc === a.issued_by;
  const mayDecide = pending && data.can.approve && !iIssued;
  const mayRevoke = data.can.revoke && a.state !== 'expired';

  async function decide(decision: 'approve' | 'reject', e?: FormEvent) {
    e?.preventDefault();
    setError('');
    if (decision === 'reject' && !reason.trim()) return setError('A rejection needs a reason; Quality sees it (D-079).');
    if (!pinLooksRight(pin)) return setError('Enter your PIN to sign.');
    setBusy(true);
    const { data: r, error: err } = await anyActions.rpc('decide_certifying_authorization', {
      p_authorization: a.id, p_decision: decision, p_pin: pin, p_reason: reason.trim() || null,
    });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    onDone(r === 'approved' ? `${a.reference} approved. It counts from ${formatPlainDate(a.valid_from, display)} (D-043 also needs a current licence and type rating).`
      : r === 'rejected' ? `${a.reference} rejected. Quality sees your reason.`
      : `${a.reference} approved at your step; it moves to the next approver.`);
  }

  async function revoke(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!reason.trim()) return setError('Give a reason (D-033).');
    if (!pinLooksRight(pin)) return setError('Enter your PIN to sign.');
    setBusy(true);
    const { data: r, error: err } = await anyActions.rpc('revoke_certifying_authorization', { p_authorization: a.id, p_reason: reason.trim(), p_pin: pin });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    onDone(`${a.reference} ${r === 'withdrawn' ? 'withdrawn' : 'revoked'}. Kept on record with your name and reason.`);
  }

  return (
    <>
      <tr>
        <td>
          <span className="mono">{a.reference}</span>
          <div className="small muted">Issued by <span className="mono">{a.issued_by}</span> · {formatDateTime(a.issued_at, display)}</div>
        </td>
        <td>{a.aircraft_type_code} certifying · all ATA</td>
        <td className="pp-hide-sm mono">{formatPlainDate(a.valid_from, display)}</td>
        <td className="mono">{formatPlainDate(a.expires_on, display)}</td>
        <td>
          <StateChip a={a} />
          {(mayDecide || mayRevoke) && (
            <div className="pp-row-actions">
              {mayDecide && <button type="button" onClick={() => setOpen(open === 'decide' ? '' : 'decide')}>Approve or reject</button>}
              {mayRevoke && <button type="button" className="outline-button danger-button" onClick={() => setOpen(open === 'revoke' ? '' : 'revoke')}>{pending ? 'Withdraw' : 'Revoke'}</button>}
            </div>
          )}
          {pending && data.can.approve && iIssued && <div className="small muted">You issued it, so another approver decides (D-032).</div>}
        </td>
      </tr>
      {open && (
        <tr className="pp-inline-row">
          <td colSpan={5}>
            <form onSubmit={(e) => (open === 'decide' ? decide('approve', e) : revoke(e))} className="pp-inline-form">
              <strong>{open === 'decide' ? `Decide ${a.reference} · ${a.aircraft_type_code} · for ${data.person.full_name}` : `${pending ? 'Withdraw' : 'Revoke'} ${a.reference}`}</strong>
              <label htmlFor={`ar-${a.id}`}>
                Reason <span className="hint">{open === 'decide' ? '(needed to reject; optional note when approving)' : '(required; kept on record)'}</span>
              </label>
              <input id={`ar-${a.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
              <PinField id={`ar-pin-${a.id}`} value={pin} onChange={setPin} />
              {error && <div className="error" role="alert">{error}</div>}
              <div className="action-row">
                {open === 'decide' ? (
                  <>
                    <button type="submit" disabled={busy}>{busy ? 'Signing…' : 'Approve'}</button>
                    <button type="button" className="outline-button danger-button" disabled={busy} onClick={() => decide('reject')}>Reject</button>
                  </>
                ) : (
                  <button type="submit" className="danger-button outline-button" disabled={busy}>{busy ? 'Signing…' : pending ? 'Withdraw authorization' : 'Revoke authorization'}</button>
                )}
                <button type="button" className="outline-button" onClick={() => { setOpen(''); setError(''); }}>Cancel</button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function IssueForm({ data, onCancel, onDone }: { data: PersonRecordData; onCancel: () => void; onDone: (m: string) => void }) {
  const [types, setTypes] = useState<{ code: string; name: string }[]>([]);
  const [type, setType] = useState('');
  const [reference, setReference] = useState('');
  const [validFrom, setValidFrom] = useState(data.today);
  const [expires, setExpires] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadAircraftTypes().then(setTypes); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!type) return setError('Choose the aircraft type.');
    if (!reference.trim()) return setError('Give the authorization reference.');
    if (!validFrom || !expires) return setError('Give the valid-from and expiry dates.');
    if (!pinLooksRight(pin)) return setError('Enter your PIN to sign.');
    setBusy(true);
    const { error: err } = await anyActions.rpc('issue_certifying_authorization', {
      p_person: data.person.id, p_reference: reference.trim(), p_aircraft_type: type,
      p_valid_from: validFrom, p_expires_on: expires, p_pin: pin,
    });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    onDone(`${reference.trim()} issued and sent to the CO / ECO for approval. It does not count until approved (D-032).`);
  }

  return (
    <form onSubmit={submit}>
      <Section title="Issue authorization (Quality)" tone="strong">
        <p className="small" style={{ margin: 0 }}>For <strong>{data.person.full_name}</strong> (<span className="mono">{data.person.three_letter_code}</span>). The CO or ECO approves it with their PIN; you cannot approve it yourself.</p>
        <div className="pp-grid">
          <div>
            <label htmlFor="ia-type">Aircraft type</label>
            <select id="ia-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Choose…</option>
              {types.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ia-ref">Authorization reference</label>
            <input id="ia-ref" className="mono" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. QA/AUTH/0123" />
          </div>
          <div>
            <label htmlFor="ia-from">Valid from</label>
            <DateField id="ia-from" value={validFrom} onChange={setValidFrom} />
          </div>
          <div>
            <label htmlFor="ia-exp">Expires on</label>
            <DateField id="ia-exp" value={expires} onChange={setExpires} min={validFrom || data.today} />
          </div>
        </div>
        <PinField id="ia-pin" value={pin} onChange={setPin} />
        {error && <div className="error" role="alert">{error}</div>}
        <div className="action-row">
          <button type="submit" disabled={busy}>{busy ? 'Signing…' : 'Issue and send for approval'}</button>
          <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
        </div>
      </Section>
    </form>
  );
}
