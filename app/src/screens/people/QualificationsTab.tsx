// WF-O2 · Licences, type ratings, medicals (D-080 to D-085).
//
// Quality records them, signed with the PIN. Nothing is edited (D-023):
//   * a renewal is a new record that REPLACES the old one (the old one stays
//     in History, marked superseded with who, when and why);
//   * a record entered in error, or no longer held, is WITHDRAWN with a reason.
// A medical holds only its class and expiry date, nothing else (D-084).
// Expiry flags: amber "Approaching" inside the operator margin
// (qualification.approaching_days), red "Reached" once expired (D-028).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { anyActions, errorText } from '../../lib/supabase';
import { formatDateTime, formatPlainDate } from '../../lib/format';
import { Section } from '../../components/PageFrame';
import { PinField } from '../../components/PinField';
import { DateField } from '../../components/DateField';
import { KIND_TEXT, loadAircraftTypes, pinLooksRight, type Flag, type PersonRecordData, type Qualification } from './types';

export function FlagChip({ flag, label }: { flag: Flag | 'approaching' | 'reached'; label?: string }) {
  if (flag === 'reached') return <span className="chip tone-red">{label ?? 'Reached · expired'}</span>;
  if (flag === 'approaching') return <span className="chip tone-amber">{label ?? 'Approaching'}</span>;
  return <span className="chip tone-green">{label ?? 'Current'}</span>;
}

function detail(q: Qualification): string {
  if (q.kind === 'medical') return q.medical_class ?? '—';
  if (q.kind === 'type_rating') return [q.aircraft_type_code, q.reference].filter(Boolean).join(' · ');
  return [q.reference, q.licence_category].filter(Boolean).join(' · ');
}

type Draft = {
  kind: Qualification['kind']; reference: string; category: string; type: string; medicalClass: string;
  authority: string; issued: string; expires: string; replaces: Qualification | null; reason: string;
};
const EMPTY: Draft = { kind: 'licence', reference: '', category: '', type: '', medicalClass: '', authority: '', issued: '', expires: '', replaces: null, reason: '' };

export function QualificationsTab({ data, onDone }: { data: PersonRecordData; onDone: (m: string) => void }) {
  const { display } = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  if (data.qualifications === null) {
    return (
      <Section title="Licences, type ratings, medicals">
        <p style={{ margin: 0 }}>Shown to the person, Quality, Command, Super Admins and the CO / ECO only.</p>
      </Section>
    );
  }
  const current = data.qualifications.filter((q) => !q.superseded_at);
  const history = data.qualifications.filter((q) => q.superseded_at);
  const hasMedical = current.some((q) => q.kind === 'medical');
  const can = data.can.record_qualifications;

  const start = (d: Draft) => {
    setDraft(d);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  return (
    <>
      <Section title="Licences, type ratings, medicals"
        actions={can && !draft && <button type="button" className="outline-button" onClick={() => start(EMPTY)}>Record a qualification</button>}>
        <p className="small muted" style={{ margin: 0 }}>
          Medical: class and expiry only. Flags: <FlagChip flag="approaching" /> within {data.approaching_days} days of expiry,{' '}
          <FlagChip flag="reached" /> once expired (operator setting).
        </p>
        <div className="table-scroll">
          <table className="ptable pp-table">
            <thead><tr><th>Item</th><th>Detail</th><th className="pp-hide-sm">Issued</th><th>Expires</th><th>Flag</th>{can && <th><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody>
              {current.map((q) => (
                <QualRow key={q.id} q={q} can={can} onRenew={() => start({
                  ...EMPTY, kind: q.kind, type: q.aircraft_type_code ?? '', category: q.licence_category ?? '',
                  medicalClass: q.medical_class ?? '', authority: q.issuing_authority ?? '', replaces: q, reason: 'Renewal',
                })} onDone={onDone} />
              ))}
              {!hasMedical && (
                <tr>
                  <td>Medical</td>
                  <td colSpan={can ? 5 : 4}>
                    {data.medical_required
                      ? <span className="chip tone-red">Required for this role · none on record</span>
                      : <span className="muted">Not required for this role (operator setting)</span>}
                  </td>
                </tr>
              )}
              {current.length === 0 && <tr><td colSpan={can ? 6 : 5} className="muted">No licence or type rating on record.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Which qualifications each role needs is set in Operator settings. Certifying also needs an approved authorization.
        </p>
      </Section>

      {draft && can && (
        <div ref={formRef}>
          <RecordForm personId={data.person.id} draft={draft} setDraft={setDraft} onDone={(m) => { setDraft(null); onDone(m); }} />
        </div>
      )}

      {history.length > 0 && (
        <Section title={`History (${history.length})`}>
          <div className="table-scroll">
            <table className="ptable pp-table">
              <thead><tr><th>Item</th><th>Detail</th><th>Expired / expires</th><th>Superseded</th><th>Why</th></tr></thead>
              <tbody>
                {history.map((q) => (
                  <tr key={q.id} className="pp-old">
                    <td>{KIND_TEXT[q.kind]}</td>
                    <td className="mono">{detail(q)}</td>
                    <td>{q.expires_on ? formatPlainDate(q.expires_on, display) : '—'}</td>
                    <td><span className="mono">{q.superseded_by}</span> · {formatDateTime(q.superseded_at, display)}</td>
                    <td>{q.superseded_reason}{q.replaced_by && <span className="small muted"> · replaced by a new record</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Records are never edited or deleted.</p>
        </Section>
      )}
    </>
  );
}

function QualRow({ q, can, onRenew, onDone }: { q: Qualification; can: boolean; onRenew: () => void; onDone: (m: string) => void }) {
  const { display } = useAuth();
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function withdraw(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!reason.trim()) return setError('Give a reason, e.g. "Entered in error" or "Licence suspended".');
    if (!pinLooksRight(pin)) return setError('Enter your PIN to sign.');
    setBusy(true);
    const { error: err } = await anyActions.rpc('withdraw_qualification', { p_qualification: q.id, p_reason: reason.trim(), p_pin: pin });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    onDone(`${KIND_TEXT[q.kind]} withdrawn. It stays in History with your name and reason.`);
  }

  return (
    <>
      <tr>
        <td>{KIND_TEXT[q.kind]}</td>
        <td>
          <span className="mono">{detail(q)}</span>
          {q.issuing_authority && <div className="small muted">{q.issuing_authority}</div>}
        </td>
        <td className="pp-hide-sm">{q.issued_on ? formatPlainDate(q.issued_on, display) : '—'}</td>
        <td className="mono">{q.expires_on ? formatPlainDate(q.expires_on, display) : <span className="muted">No expiry</span>}</td>
        <td>{q.flag && <FlagChip flag={q.flag} />}</td>
        {can && (
          <td className="pp-row-actions">
            <button type="button" className="outline-button" onClick={onRenew}>Renew</button>
            <button type="button" className="outline-button" onClick={() => setWithdrawing((w) => !w)}>Withdraw</button>
          </td>
        )}
      </tr>
      {withdrawing && (
        <tr className="pp-inline-row">
          <td colSpan={6}>
            <form onSubmit={withdraw} className="pp-inline-form">
              <label htmlFor={`wd-${q.id}`}>Reason for withdrawing <span className="hint">(kept in History)</span></label>
              <input id={`wd-${q.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered in error" />
              <PinField id={`wd-pin-${q.id}`} value={pin} onChange={setPin} />
              {error && <div className="error" role="alert">{error}</div>}
              <div className="action-row">
                <button type="submit" disabled={busy}>{busy ? 'Signing…' : 'Withdraw record'}</button>
                <button type="button" className="outline-button" onClick={() => setWithdrawing(false)}>Cancel</button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function RecordForm({ personId, draft, setDraft, onDone }: {
  personId: string; draft: Draft; setDraft: (d: Draft | null) => void; onDone: (m: string) => void;
}) {
  const [types, setTypes] = useState<{ code: string; name: string }[]>([]);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadAircraftTypes().then(setTypes); }, []);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const medical = draft.kind === 'medical';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (medical && (!draft.medicalClass.trim() || !draft.expires)) return setError('A medical needs its class and expiry date.');
    if (!medical && (!draft.authority.trim() || !draft.issued)) return setError('Give the issuing authority and the issue date.');
    if (draft.kind === 'licence' && !draft.reference.trim()) return setError('Give the licence number.');
    if (draft.kind === 'type_rating' && !draft.type) return setError('Choose the aircraft type.');
    if (draft.replaces && !draft.reason.trim()) return setError('Give a reason for replacing the old record.');
    if (!pinLooksRight(pin)) return setError('Enter your PIN to sign.');
    setBusy(true);
    const { error: err } = await anyActions.rpc('record_qualification', {
      p_person: personId, p_kind: draft.kind, p_pin: pin,
      p_reference: medical ? null : draft.reference.trim() || null,
      p_licence_category: draft.kind === 'licence' ? draft.category.trim() || null : null,
      p_aircraft_type: draft.kind === 'type_rating' ? draft.type : null,
      p_medical_class: medical ? draft.medicalClass.trim() : null,
      p_issuing_authority: medical ? null : draft.authority.trim(),
      p_issued_on: medical ? null : draft.issued,
      p_expires_on: draft.expires || null,
      p_replaces: draft.replaces?.id ?? null,
      p_reason: draft.replaces ? draft.reason.trim() : null,
    });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    onDone(`${KIND_TEXT[draft.kind]} recorded${draft.replaces ? '; the old record is kept in History' : ''}.`);
  }

  return (
    <form onSubmit={submit}>
      <Section title={draft.replaces ? `Renew ${KIND_TEXT[draft.kind].toLowerCase()} (Quality)` : 'Record a qualification (Quality)'} tone="strong">
        {draft.replaces
          ? <p className="small" style={{ margin: 0 }}>Replaces <span className="mono">{detail(draft.replaces)}</span>. The old record stays in History.</p>
          : (
            <div>
              <label htmlFor="qf-kind" style={{ marginTop: 0 }}>Kind</label>
              <select id="qf-kind" value={draft.kind} onChange={(e) => set({ kind: e.target.value as Draft['kind'] })}>
                <option value="licence">Licence</option>
                <option value="type_rating">Type rating</option>
                <option value="medical">Medical</option>
              </select>
            </div>
          )}

        {medical ? (
          <>
            <div className="notice">Medical: class and expiry date only. No diagnoses, limitations or other details are stored.</div>
            <div className="pp-grid">
              <div>
                <label htmlFor="qf-class">Medical class</label>
                <input id="qf-class" value={draft.medicalClass} onChange={(e) => set({ medicalClass: e.target.value })} placeholder="e.g. Class 1" />
              </div>
              <div>
                <label htmlFor="qf-exp">Expires on</label>
                <DateField id="qf-exp" value={draft.expires} onChange={(v) => set({ expires: v })} />
              </div>
            </div>
          </>
        ) : (
          <div className="pp-grid">
            {draft.kind === 'type_rating' && (
              <div>
                <label htmlFor="qf-type">Aircraft type</label>
                <select id="qf-type" value={draft.type} disabled={Boolean(draft.replaces)} onChange={(e) => set({ type: e.target.value })}>
                  <option value="">Choose…</option>
                  {types.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="qf-ref">{draft.kind === 'licence' ? 'Licence number' : 'Rating reference'} {draft.kind === 'type_rating' && <span className="hint">(optional)</span>}</label>
              <input id="qf-ref" className="mono" value={draft.reference} onChange={(e) => set({ reference: e.target.value })} />
            </div>
            {draft.kind === 'licence' && (
              <div>
                <label htmlFor="qf-cat">Category <span className="hint">(as written on the licence)</span></label>
                <input id="qf-cat" value={draft.category} onChange={(e) => set({ category: e.target.value })} />
              </div>
            )}
            <div>
              <label htmlFor="qf-auth">Issuing authority</label>
              <input id="qf-auth" value={draft.authority} onChange={(e) => set({ authority: e.target.value })} />
            </div>
            <div>
              <label htmlFor="qf-iss">Issued on</label>
              <DateField id="qf-iss" value={draft.issued} onChange={(v) => set({ issued: v })} />
            </div>
            <div>
              <label htmlFor="qf-exp">Expires on <span className="hint">(leave empty if none)</span></label>
              <DateField id="qf-exp" value={draft.expires} onChange={(v) => set({ expires: v })} min={draft.issued || undefined} />
            </div>
          </div>
        )}

        {draft.replaces && (
          <>
            <label htmlFor="qf-reason">Reason for replacing</label>
            <input id="qf-reason" value={draft.reason} onChange={(e) => set({ reason: e.target.value })} />
          </>
        )}
        <PinField id="qf-pin" value={pin} onChange={setPin} />
        {error && <div className="error" role="alert">{error}</div>}
        <div className="action-row">
          <button type="submit" disabled={busy}>{busy ? 'Signing…' : draft.replaces ? 'Record renewal' : 'Record'}</button>
          <button type="button" className="outline-button" onClick={() => setDraft(null)}>Cancel</button>
        </div>
      </Section>
    </form>
  );
}
