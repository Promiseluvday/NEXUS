// The ADs and SBs forms (WF-S1):
//   EntryForm      an engineer records or corrects one aircraft's entry, PIN
//   DocumentForm   an engineer registers an AD / SB, or corrects it (new version)
//   QualityForm    Quality countersigns (PIN) or rejects with a reason
//
// What the engineer types is sent as typed. The screen never works out a
// next due from the last-complied figures (D-021); the database checks the
// rules again and answers in plain English (D-125).
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { anyActions, errorText } from '../../lib/supabase';
import { DateField } from '../../components/DateField';
import { PinField } from '../../components/PinField';
import { useComplianceMethods, type AdSbDocument, type AdSbEntry, type Status } from './data';

type EntryFields = {
  applicability: 'applicable' | 'not_applicable' | '';
  not_applicable_reason: string;
  compliance_method: string;
  status: Status | '';
  last_complied_on: string; last_complied_hours: string; last_complied_cycles: string;
  next_due_on: string; next_due_hours: string; next_due_cycles: string; next_due_text: string;
  compliance_reference: string; remarks: string;
};

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function fromEntry(e?: AdSbEntry | null): EntryFields {
  return {
    applicability: e?.applicability ?? '',
    not_applicable_reason: s(e?.not_applicable_reason),
    compliance_method: s(e?.compliance_method),
    status: e?.status ?? '',
    last_complied_on: s(e?.last_complied_on), last_complied_hours: s(e?.last_complied_hours), last_complied_cycles: s(e?.last_complied_cycles),
    next_due_on: s(e?.next_due_on), next_due_hours: s(e?.next_due_hours), next_due_cycles: s(e?.next_due_cycles),
    next_due_text: s(e?.next_due_text),
    compliance_reference: s(e?.compliance_reference), remarks: s(e?.remarks),
  };
}

const decimal = (v: string) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const whole = (v: string) => v.replace(/[^0-9]/g, '');

// New entry (documents = the type's ADs / SBs not yet entered on this tail,
// documentKey = preselected) or correction (entry = the version in force).
export function EntryForm({ aircraftId, tail, documents, documentKey, entry, onDone, onCancel }: {
  aircraftId: string; tail: string; documents?: AdSbDocument[]; documentKey?: string | null;
  entry?: AdSbEntry | null; onDone: (message: string, entryKey?: string) => void; onCancel: () => void;
}) {
  const { me } = useAuth();
  const methods = useComplianceMethods();
  const correcting = Boolean(entry);
  const [doc, setDoc] = useState(documentKey ?? '');
  const [f, setF] = useState<EntryFields>(fromEntry(entry));
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof EntryFields>(k: K, v: EntryFields[K]) => setF((x) => ({ ...x, [k]: v }));
  const na = f.applicability === 'not_applicable';
  const closed = f.status === 'complied' || na;
  const chosen = documents?.find((d) => d.document_key === doc);

  function setApplicability(v: EntryFields['applicability']) {
    setF((x) => ({ ...x, applicability: v,
      status: v === 'not_applicable' ? 'not_applicable' : x.status === 'not_applicable' ? '' : x.status }));
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    if (!correcting && !doc) return setError('Choose the AD or SB.');
    if (!f.applicability) return setError(`Record whether it applies to ${tail}.`);
    if (!f.status) return setError('Choose a status.');
    if (correcting && !reason.trim()) return setError('Give the reason for the correction.');
    if (!pin) return setError('Enter your PIN to sign.');
    // Only the fields that belong to the chosen status are sent.
    const fields: Record<string, string> = { applicability: f.applicability, status: f.status };
    if (na) fields.not_applicable_reason = f.not_applicable_reason;
    else {
      fields.compliance_method = f.compliance_method;
      fields.last_complied_on = f.last_complied_on;
      fields.last_complied_hours = f.last_complied_hours;
      fields.last_complied_cycles = f.last_complied_cycles;
      if (!closed) {
        fields.next_due_on = f.next_due_on;
        fields.next_due_hours = f.next_due_hours;
        fields.next_due_cycles = f.next_due_cycles;
        fields.next_due_text = f.next_due_text;
      }
    }
    fields.compliance_reference = f.compliance_reference;
    fields.remarks = f.remarks;
    setBusy(true);
    const { data, error: err } = correcting
      ? await anyActions.rpc('correct_adsb_compliance', { p_entry: entry!.id, p_fields: fields, p_reason: reason.trim(), p_pin: pin, p_device_time: new Date().toISOString() })
      : await anyActions.rpc('enter_adsb_compliance', { p_aircraft: aircraftId, p_document_key: doc, p_fields: fields, p_pin: pin, p_device_time: new Date().toISOString() });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    const name = entry ? `${entry.doc_type} ${entry.reference}` : chosen ? `${chosen.doc_type} ${chosen.reference}` : 'The entry';
    onDone(correcting
      ? `${name} corrected on ${tail} (version ${entry!.version + 1}). It now waits for Quality to verify it again.`
      : `${name} recorded on ${tail}. It waits for Quality to verify it.`, entry?.entry_key ?? (data as string));
  }

  return (
    <form onSubmit={submit} className="adsb-form">
      {!correcting && (
        <div>
          <label htmlFor="adsb-doc">AD or SB</label>
          <select id="adsb-doc" value={doc} onChange={(e) => setDoc(e.target.value)}>
            <option value="">Choose from the register…</option>
            {(documents ?? []).map((d) => (
              <option key={d.document_key} value={d.document_key}>
                {d.doc_type} {d.reference}{d.revision ? ` Rev ${d.revision}` : ''} · {d.title}
              </option>
            ))}
          </select>
          {documents && documents.length === 0 && <p className="small muted">Every AD and SB for this type already has an entry on {tail}. Register a new one first, or correct an entry.</p>}
          {chosen && <p className="small muted">{chosen.issuing_authority} · applies to the {chosen.aircraft_type_code}{chosen.applies_to_note ? ` · ${chosen.applies_to_note}` : ''}</p>}
        </div>
      )}

      <fieldset className="adsb-fieldset">
        <legend>Applicability (you decide, D-016)</legend>
        <div className="row">
          <label className="check"><input type="radio" name="adsb-app" checked={f.applicability === 'applicable'} onChange={() => setApplicability('applicable')} /> Applicable to {tail}</label>
          <label className="check"><input type="radio" name="adsb-app" checked={na} onChange={() => setApplicability('not_applicable')} /> Not applicable</label>
        </div>
        {na && (
          <>
            <label htmlFor="adsb-na">Reason it does not apply</label>
            <input id="adsb-na" value={f.not_applicable_reason} placeholder="e.g. serial number outside the effectivity"
              onChange={(e) => set('not_applicable_reason', e.target.value)} />
          </>
        )}
      </fieldset>

      {!na && (
        <div className="adsb-grid2">
          <div>
            <label htmlFor="adsb-status">Status</label>
            <select id="adsb-status" value={f.status} onChange={(e) => set('status', e.target.value as Status)}>
              <option value="">Choose…</option>
              <option value="open">Open: not yet complied with</option>
              <option value="recurring">Recurring: repeats, next due entered</option>
              <option value="complied">Complied: terminating action done</option>
            </select>
          </div>
          <div>
            <label htmlFor="adsb-method">Compliance method</label>
            <input id="adsb-method" list="adsb-methods" value={f.compliance_method} onChange={(e) => set('compliance_method', e.target.value)}
              placeholder="e.g. Repetitive inspection" />
            <datalist id="adsb-methods">{methods.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
        </div>
      )}

      {!na && (
        <fieldset className="adsb-fieldset">
          <legend>Last complied (as entered)</legend>
          <div className="adsb-grid3">
            <div><label htmlFor="adsb-ld">Date</label><DateField id="adsb-ld" value={f.last_complied_on} onChange={(v) => set('last_complied_on', v)} /></div>
            <div><label htmlFor="adsb-lh">Flight hours</label>
              <input id="adsb-lh" className="mono" inputMode="decimal" value={f.last_complied_hours} onChange={(e) => set('last_complied_hours', decimal(e.target.value))} /></div>
            <div><label htmlFor="adsb-lc">Cycles</label>
              <input id="adsb-lc" className="mono" inputMode="numeric" value={f.last_complied_cycles} onChange={(e) => set('last_complied_cycles', whole(e.target.value))} /></div>
          </div>
        </fieldset>
      )}

      {!closed && f.status && (
        <fieldset className="adsb-fieldset">
          <legend>Next due, as you work it out from the document</legend>
          <p className="small muted adsb-tight">Nexus does not calculate it (D-021). Enter a date, hours, cycles and/or the limit in words.</p>
          <div className="adsb-grid3">
            <div><label htmlFor="adsb-nd">Due date</label><DateField id="adsb-nd" value={f.next_due_on} onChange={(v) => set('next_due_on', v)} /></div>
            <div><label htmlFor="adsb-nh">Due at flight hours</label>
              <input id="adsb-nh" className="mono" inputMode="decimal" value={f.next_due_hours} onChange={(e) => set('next_due_hours', decimal(e.target.value))} /></div>
            <div><label htmlFor="adsb-nc">Due at cycles</label>
              <input id="adsb-nc" className="mono" inputMode="numeric" value={f.next_due_cycles} onChange={(e) => set('next_due_cycles', whole(e.target.value))} /></div>
          </div>
          <label htmlFor="adsb-nt">Limit in words <span className="hint">(optional)</span></label>
          <input id="adsb-nt" value={f.next_due_text} placeholder="e.g. 500 FH or 12 months, whichever first" onChange={(e) => set('next_due_text', e.target.value)} />
        </fieldset>
      )}

      <div className="adsb-grid2">
        <div>
          <label htmlFor="adsb-ref">Compliance reference <span className="hint">(work order, logbook entry)</span></label>
          <input id="adsb-ref" className="mono" value={f.compliance_reference} onChange={(e) => set('compliance_reference', e.target.value)} />
        </div>
        <div>
          <label htmlFor="adsb-rem">Remarks</label>
          <input id="adsb-rem" value={f.remarks} onChange={(e) => set('remarks', e.target.value)} />
        </div>
      </div>

      {correcting && (
        <>
          <label htmlFor="adsb-why">Reason for the correction</label>
          <textarea id="adsb-why" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={entry?.verification_state === 'rejected' ? `Quality: ${entry.verification_note ?? ''}` : 'What was wrong and what you changed'} />
          <p className="small muted">The current version stays in history (D-023). The new version needs Quality's verification again.</p>
        </>
      )}

      <PinField id="adsb-pin" value={pin} onChange={setPin} />
      <p className="small muted">Entered by <span className="mono">{me?.tlc}</span>; Quality verifies it next.</p>
      {error && <div className="error" role="alert">{error}</div>}
      <p className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : correcting ? 'Save correction' : 'Save entry'}</button>
        <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
      </p>
    </form>
  );
}

// Register an AD / SB, or correct the record (a new version with a reason).
export function DocumentForm({ types, doc, defaultType, onDone, onCancel }: {
  types: { code: string; name: string }[]; doc?: AdSbDocument | null; defaultType?: string;
  onDone: (message: string, documentKey?: string) => void; onCancel: () => void;
}) {
  const [f, setF] = useState({
    doc_type: doc?.doc_type ?? 'AD', reference: doc?.reference ?? '', title: doc?.title ?? '',
    issuing_authority: doc?.issuing_authority ?? '', aircraft_type_code: doc?.aircraft_type_code ?? defaultType ?? '',
    applies_to_note: doc?.applies_to_note ?? '', revision: doc?.revision ?? '', effective_on: doc?.effective_on ?? '',
  });
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    if (!f.reference.trim() || !f.title.trim() || !f.issuing_authority.trim() || !f.aircraft_type_code) {
      return setError('Reference, title, issuing authority and aircraft type are needed.');
    }
    if (doc && !reason.trim()) return setError('Give the reason for the correction (e.g. "Revision 2 issued").');
    setBusy(true);
    const { data, error: err } = doc
      ? await anyActions.rpc('correct_adsb_document', { p_document_key: doc.document_key, p_fields: f, p_reason: reason.trim(), p_device_time: new Date().toISOString() })
      : await anyActions.rpc('register_adsb_document', { p_fields: f, p_device_time: new Date().toISOString() });
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone(doc ? `${f.doc_type} ${f.reference} corrected (version ${doc.version + 1}). Entries on aircraft are marked for review.`
      : `${f.doc_type} ${f.reference} added to the register.`, doc ? doc.document_key : (data as string));
  }

  return (
    <form onSubmit={submit} className="adsb-form">
      <div className="adsb-grid3">
        <div><label htmlFor="d-type">Type</label>
          <select id="d-type" value={f.doc_type} onChange={(e) => set('doc_type', e.target.value)}>
            <option value="AD">AD · Airworthiness Directive</option>
            <option value="SB">SB · Service Bulletin</option>
          </select></div>
        <div><label htmlFor="d-ref">Reference <span className="hint">(as printed)</span></label>
          <input id="d-ref" className="mono" value={f.reference} onChange={(e) => set('reference', e.target.value)} /></div>
        <div><label htmlFor="d-rev">Revision</label>
          <input id="d-rev" className="mono" value={f.revision} onChange={(e) => set('revision', e.target.value)} /></div>
      </div>
      <label htmlFor="d-title">Title</label>
      <input id="d-title" value={f.title} onChange={(e) => set('title', e.target.value)} />
      <div className="adsb-grid3">
        <div><label htmlFor="d-auth">{f.doc_type === 'SB' ? 'Issued by (manufacturer)' : 'Issuing authority'}</label>
          <input id="d-auth" value={f.issuing_authority} onChange={(e) => set('issuing_authority', e.target.value)} /></div>
        <div><label htmlFor="d-act">Applies to aircraft type</label>
          <select id="d-act" value={f.aircraft_type_code} onChange={(e) => set('aircraft_type_code', e.target.value)}>
            <option value="">Choose…</option>
            {types.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
          </select></div>
        <div><label htmlFor="d-eff">Effective date</label>
          <DateField id="d-eff" value={f.effective_on} onChange={(v) => set('effective_on', v)} /></div>
      </div>
      <label htmlFor="d-note">Effectivity note <span className="hint">(engine, part number, serial range, as written)</span></label>
      <input id="d-note" value={f.applies_to_note} onChange={(e) => set('applies_to_note', e.target.value)} />
      {doc && (
        <>
          <label htmlFor="d-why">Reason for the correction</label>
          <input id="d-why" value={reason} placeholder='e.g. "Revision 2 issued" or "Title mistyped"' onChange={(e) => setReason(e.target.value)} />
          <p className="small muted">Version {doc.version} stays in history (D-023).</p>
        </>
      )}
      <p className="small muted">The register is typed in by engineers from the operator's own copy. Nexus imports nothing (D-016, D-112).</p>
      {error && <div className="error" role="alert">{error}</div>}
      <p className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : doc ? 'Save correction' : 'Add to register'}</button>
        <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
      </p>
    </form>
  );
}

// Quality's countersign (PIN) or rejection with a reason (WF-S1).
export function QualityForm({ entry, onDone }: { entry: AdSbEntry; onDone: (message: string) => void }) {
  const [pin, setPin] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function decide(kind: 'verify' | 'reject') {
    setError('');
    if (kind === 'reject' && !note.trim()) return setError('Give the reason for rejecting, so the engineer can correct it.');
    if (!pin) return setError('Enter your PIN to sign.');
    setBusy(true);
    const { error: err } = kind === 'verify'
      ? await anyActions.rpc('verify_adsb_compliance', { p_entry: entry.id, p_pin: pin, p_note: note.trim() || null })
      : await anyActions.rpc('reject_adsb_compliance', { p_entry: entry.id, p_reason: note.trim(), p_pin: pin });
    setBusy(false);
    setPin('');
    if (err) return setError(errorText(err));
    onDone(kind === 'verify'
      ? `${entry.doc_type} ${entry.reference} on ${entry.tail} verified.`
      : `${entry.doc_type} ${entry.reference} on ${entry.tail} rejected. The engineer corrects it.`);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); decide('verify'); }} className="adsb-form">
      <label htmlFor="q-note">Note <span className="hint">(required to reject)</span></label>
      <textarea id="q-note" value={note} onChange={(e) => setNote(e.target.value)} />
      <PinField id="q-pin" value={pin} onChange={setPin} />
      {error && <div className="error" role="alert">{error}</div>}
      <p className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Signing…' : 'Countersign entry'}</button>
        <button type="button" className="outline-button danger-button" disabled={busy} onClick={() => decide('reject')}>Reject with reason</button>
      </p>
    </form>
  );
}
