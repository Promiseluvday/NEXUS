// The dispositions of an attended snag (D-040, D-214, D-218), laid out as
// the Claude Design wireframes WF-D4 (choose a path), WF-E4 (apply an MEL
// item) and WF-DD2 (defer on the DDLS, not MEL):
//
//   Request work order → any rectification, troubleshooting or "no fault
//                      found" needs a work order approved by Quality, then
//                      the CO (D-063, D-218). No fault found is recorded when
//                      the work order is certified.
//   Defer under MEL  → choose the item, confirm (M), (O) and placard, sign;
//                      logged on the DDLS automatically (D-053, D-163)
//   Defer on DDLS    → not an MEL item: days allowed with a manual reference
//   Defer as NADD    → no airworthiness effect, not emergency equipment (D-160, D-209)
// Deferring is the only thing allowed without a work order (D-218).
//
// "Request work order" is the main button; the deferrals sit in one
// "Defer instead" dropdown; only the chosen form shows (docs/ui-rules.md).
// The wireframe's fifth card, "No fault found", is not offered here: since
// D-218 no fault found is a tick when the work order is certified.
// Signing needs a certifying engineer for the type and their PIN (D-043,
// D-094). The DATABASE checks all of this again; the screen only guides.
// The limits shown are the ones the MEL or the engineer state. Nexus never
// decides airworthiness (D-020).
//
// MEL and DDLS deferrals offer "also set the tail to Serviceable · MEL"
// (D-216). It is the engineer's own tick, signed with the same PIN, and both
// are recorded together or not at all. It starts ticked only when the tail
// is currently Serviceable; otherwise the engineer must decide.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { actions, db, errorText } from '../lib/supabase';
import { perform, queuedText } from '../lib/perform';
import { cached } from '../lib/offline/cache';
import { PinField } from '../components/PinField';
import { MelSearch, melInterval, type MelItem } from '../components/MelSearch';
import { TAIL_STATUS } from '../components/StatusChip';
import { Section } from '../components/PageFrame';

export type SnagForDisposition = {
  id: string;
  number: string;
  aircraft_id: string;
  aircraft_type: string;
  tlb_book: string | null;
  tlb_page: string | null;
  tlb_item: string | null;
  tail: string;
  tail_status: string | null; // the engineer-set status now (D-046)
  description?: string;       // the report as written, shown read-only on the DDLS form
};

export type Kind = 'rectify_now' | 'mel' | 'ddls' | 'nadd';

// Each path with the one-line explanation from the wireframe (WF-D4).
const KINDS: { key: Kind; label: string; signs: boolean; what: string }[] = [
  { key: 'rectify_now', label: 'Request work order', signs: false,
    what: 'Rectify, troubleshoot or find no fault. Quality, then the CO, approve the work order before any work is recorded.' },
  { key: 'mel', label: 'Defer under the MEL', signs: true,
    what: 'Goes on the DDLS automatically. Certifying engineer, PIN.' },
  { key: 'ddls', label: 'Defer on the DDLS (not an MEL item)', signs: true,
    what: 'Airworthiness-related, not covered by the MEL: days allowed with a manual reference. Certifying engineer, PIN.' },
  { key: 'nadd', label: 'Defer as a NADD (no airworthiness effect)', signs: true,
    what: 'Convenience item with no airworthiness effect, never emergency equipment; the engineer confirms. PIN.' },
];

type Props = {
  snag: SnagForDisposition;
  canCertify: boolean;
  onDone: (message: string) => void;
  onChoose?: () => void;   // clears any earlier message when a disposition is picked
  initialKind?: Kind | ''; // opened from "Request work order" or "Defer…" on the snag page
  onCancel?: () => void;   // "Cancel" on a form: back to the snag page
};

export function Disposition({ snag, canCertify, onDone, onChoose, initialKind = '', onCancel }: Props) {
  const [kind, setKind] = useState<Kind | ''>(initialKind);
  useEffect(() => setKind(initialKind), [initialKind]);
  const chosen = KINDS.find((k) => k.key === kind);
  const choose = (k: Kind | '') => { setKind(k); onChoose?.(); };
  // Cancel closes the form; if the page has somewhere to go back to, go there.
  const cancel = () => { setKind(''); onCancel?.(); };

  return (
    <>
      <Section title="Choose one path">
        <p className="small muted" style={{ margin: 0 }}>
          Any work on this snag, including troubleshooting and "no fault found", needs an approved work order (D-218).
          Without one, it can only be deferred.
        </p>
        <div className="disposition-choice">
          <button type="button" className={kind === 'rectify_now' ? 'chosen' : ''} aria-pressed={kind === 'rectify_now'}
            onClick={() => choose('rectify_now')}>
            Request work order
          </button>
          <label className="visually-hidden" htmlFor="disposition">Defer instead</label>
          <select id="disposition" value={kind === 'rectify_now' ? '' : kind} onChange={(e) => choose(e.target.value as Kind)}>
            <option value="">Defer instead…</option>
            {KINDS.filter((k) => k.key !== 'rectify_now').map((k) => (
              <option key={k.key} value={k.key}>{k.label}{k.signs && !canCertify ? ' (certifying engineer)' : ''}</option>
            ))}
          </select>
        </div>
        {/* What each path means, so the dropdown hides no information. */}
        <dl className="path-list">
          {KINDS.map((k) => (
            <div key={k.key} className={kind === k.key ? 'chosen' : ''}>
              <dt>{k.label}</dt>
              <dd>{k.what}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {chosen?.signs && !canCertify && (
        <div className="notice">
          This needs a certifying engineer for the {snag.aircraft_type} (D-043). You do not hold a valid
          authorization for this type, so the database will refuse your signature. Ask a certifying engineer,
          or request a work order.
        </div>
      )}
      {kind === 'rectify_now' && (
        <Section title={<>Request work order · <span className="mono">{snag.number}</span></>} tone="strong">
          <WorkOrderForm snag={snag} onDone={onDone} onCancel={cancel} />
        </Section>
      )}
      {kind === 'mel' && <MelForm snag={snag} onDone={onDone} onCancel={cancel} />}
      {kind === 'ddls' && <DdlsForm snag={snag} onDone={onDone} onCancel={cancel} />}
      {kind === 'nadd' && <NaddForm snag={snag} onDone={onDone} onCancel={cancel} />}
    </>
  );
}

// ---------------------------------------------------------------- helpers

type FormProps = { snag: SnagForDisposition; onDone: (message: string) => void; onCancel: () => void };

// Shared send-and-report logic for every form.
function useSubmit(onDone: (m: string) => void) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(check: () => string | null, send: () => Promise<{ error: { message?: string } | null; message?: string }>) {
    setError('');
    const problem = check();
    if (problem) return setError(problem);
    setBusy(true);
    const { error: err, message } = await send();
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone(message ?? 'Saved.');
  }
  return { error, busy, run };
}

function Submit({ busy, label, error, onCancel }: { busy: boolean; label: string; error: string; onCancel?: () => void }) {
  return (
    <>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Sending…' : label}</button>
        {onCancel && <button type="button" className="outline-button" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
    </>
  );
}

// Tech log reference (D-164), filled in from the report and correctable.
// Its own box, as in the wireframes (WF-D4, WF-E4, WF-DD2).
function TlbFields({ book, page, item, onChange, withItem = true }: {
  book: string; page: string; item?: string; withItem?: boolean;
  onChange: (k: 'book' | 'page' | 'item', v: string) => void;
}) {
  return (
    <Section title="Technical log reference (paper TLB)">
      <div className="field-grid">
        <div><label htmlFor="tlb-book">TLB Book No</label>
          <input id="tlb-book" className="mono" value={book} onChange={(e) => onChange('book', e.target.value)} /></div>
        <div><label htmlFor="tlb-page">TLB Page No</label>
          <input id="tlb-page" className="mono" value={page} onChange={(e) => onChange('page', e.target.value)} /></div>
        {withItem && <div><label htmlFor="tlb-item">TLB Item No</label>
          <input id="tlb-item" className="mono" value={item ?? ''} onChange={(e) => onChange('item', e.target.value)} /></div>}
      </div>
    </Section>
  );
}

function useTlb(snag: SnagForDisposition) {
  const [tlb, setTlb] = useState({ book: snag.tlb_book ?? '', page: snag.tlb_page ?? '', item: snag.tlb_item ?? '' });
  const change = (k: 'book' | 'page' | 'item', v: string) => setTlb((t) => ({ ...t, [k]: v }));
  const args = { p_tlb_book: tlb.book || undefined, p_tlb_page: tlb.page || undefined, p_tlb_item: tlb.item || undefined };
  return { tlb, change, args };
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

// Deferring never changes the tail status by itself (D-046).
const STATUS_HINT = ' The tail status is unchanged: set it on the snag page if it should change.';
const statusMessage = (set: boolean, tail: string) =>
  set ? ` ${tail} is now Serviceable · MEL, signed by you.` : STATUS_HINT;

// "Also set the tail to Serviceable · MEL" (D-216).
function useSvcMel(snag: SnagForDisposition) {
  const [v, setV] = useState(snag.tail_status === 'SVC');
  // The tail status may arrive a moment after the form opens.
  useEffect(() => setV(snag.tail_status === 'SVC'), [snag.tail_status]);
  return [v, setV] as const;
}
function SvcMelOption({ snag, checked, onChange }: { snag: SnagForDisposition; checked: boolean; onChange: (v: boolean) => void }) {
  const now = snag.tail_status ? TAIL_STATUS[snag.tail_status]?.long ?? snag.tail_status : 'no status recorded';
  const warn = snag.tail_status === 'US' || snag.tail_status === 'AOG' || snag.tail_status === 'IN_CHECK';
  return (
    <div className="option-box">
      <Check checked={checked} onChange={onChange}>
        Also set <span className="mono">{snag.tail}</span> to <strong>Serviceable · MEL</strong> (now: {now})
      </Check>
      {warn && (
        <div className="small">
          The tail is currently {now}. Tick only if, with this deferral, you are releasing it as serviceable.
          Other open items still stand.
        </div>
      )}
      {snag.tail_status === 'SVC_MEL' && <div className="small muted">Already Serviceable · MEL; no need to set it again.</div>}
    </div>
  );
}

const pinOk = (pin: string) => (/^[0-9]{4,8}$/.test(pin) ? null : 'Enter your PIN (4 to 8 digits) to sign.');

// ------------------------------------------------------------ the forms

// Used here and on other screens (Request work order, DDLS sheet), so it
// stays a plain form; the caller puts it in a box.
export function WorkOrderForm({ snag, onDone, deferred = false, onCancel }: {
  snag: { id: string }; onDone: (message: string) => void; deferred?: boolean; onCancel?: () => void;
}) {
  const [scope, setScope] = useState('');
  const [hours, setHours] = useState('');
  const { error, busy, run } = useSubmit(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(
      () => (scope.trim() ? null : 'Describe the work to be done.'),
      async () => {
        const { data, error: err } = await actions.rpc('request_work_order', {
          p_snag: snag.id, p_scope: scope.trim(), p_est_man_hours: hours ? Number(hours) : undefined,
        });
        if (err) return { error: err };
        const { data: wo } = await db.from('work_order').select('number').eq('id', data as string).maybeSingle();
        return { error: null, message: `${wo?.number ?? 'Work order'} requested. It is locked until Quality, then the CO, approve it (D-063).` };
      },
    );
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="wo-scope" style={{ marginTop: 0 }}>Work to be done <span className="hint">(rectification, or troubleshooting)</span></label>
      <textarea id="wo-scope" value={scope} onChange={(e) => setScope(e.target.value)} required />
      <label htmlFor="wo-hours">Estimated man-hours <span className="hint">(optional)</span></label>
      <input id="wo-hours" type="number" min="0" step="0.5" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
      <p className="small muted">
        No signature yet: the work order goes to Quality, then the CO. Work is recorded and certified on the work order;
        certifying it closes the snag{deferred ? ' and clears its DDLS entry or NADD' : ''}, or records "no fault found".
        {deferred && ' The deferral stays in force until then.'}
      </p>
      <Submit busy={busy} error={error} label="Request work order" onCancel={onCancel} />
    </form>
  );
}

// Apply MEL item (WF-E4): search, the item as the MEL states it, the
// confirmations, the TLB reference, then sign.
function MelForm({ snag, onDone, onCancel }: FormProps) {
  const [item, setItem] = useState<MelItem | null>(null);
  const [mDone, setMDone] = useState(false);
  const [oPassed, setOPassed] = useState(false);
  const [placard, setPlacard] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [pin, setPin] = useState('');
  const [svcMel, setSvcMel] = useSvcMel(snag);
  const { tlb, change, args } = useTlb(snag);
  const { error, busy, run } = useSubmit(onDone);

  function submit(e: FormEvent) {
    e.preventDefault();
    run(
      () => {
        if (!item) return 'Choose the MEL item.';
        if (item.m_procedure && !mDone) return 'Confirm the (M) maintenance procedure is done.';
        if (item.o_procedure && !oPassed) return 'Confirm the (O) procedure is passed to Operations.';
        if (!placard) return 'Confirm the placard is fitted.';
        return pinOk(pin);
      },
      async () => {
        const label = `Defer ${snag.number} under MEL ${item!.item_number}`;
        const { data, error: err, queued } = await perform('apply_mel', {
          p_snag: snag.id, p_mel_item: item!.id, p_pin: pin,
          p_m_done: mDone, p_o_passed: oPassed, p_placard_fitted: placard,
          p_remarks: remarks.trim() || undefined, ...args, p_set_svc_mel: svcMel,
        }, { label: label, recordPath: `/snags/${snag.id}`, aircraftId: snag.aircraft_id });
        if (err) return { error: err };
        if (queued) return { error: null, message: queuedText({ queued }, label) };
        const { data: d } = await db.from('ddls_entry').select('page_no, entry_no').eq('id', data as string).maybeSingle();
        return { error: null, message: `Deferred under MEL ${item!.item_number}. Logged on the DDLS${d ? `, page ${d.page_no} entry ${d.entry_no}` : ''}.${statusMessage(svcMel, snag.tail)}` };
      },
    );
  }
  return (
    <form className="disp-form" onSubmit={submit}>
      <Section title={<>Apply MEL item · <span className="mono">{snag.tail}</span></>} tone="strong">
        <p className="small muted" style={{ margin: 0 }}>
          From <span className="mono">{snag.number}</span> · items from the active MEL revision for the {snag.aircraft_type} only.
        </p>
        <label htmlFor="mel-search" style={{ margin: 0 }}>MEL item</label>
        <MelSearch aircraftId={snag.aircraft_id} aircraftType={snag.aircraft_type} value={item} onChange={(i) => { setItem(i); setMDone(false); setOPassed(false); }} />
      </Section>

      <Section title="Filled in from the chosen item (read-only)">
        {!item ? <p className="small muted" style={{ margin: 0 }}>Choose an item from the suggestions above.</p> : (
          <div className="facts-grid ro-facts">
            <div><div className="k">Item</div><div className="v mono">{item.item_number}</div></div>
            <div><div className="k">Title</div><div className="v">{item.title}</div></div>
            <div><div className="k">Category</div><div className="v mono">{item.category}</div></div>
            <div><div className="k">Interval (as stated in the MEL)</div><div className="v">{melInterval(item)}</div></div>
            <div><div className="k">(M) / (O) procedures</div><div className="v">{[item.m_procedure && '(M)', item.o_procedure && '(O)'].filter(Boolean).join(' ') || 'None'}</div></div>
            <div><div className="k">MEL revision</div><div className="v mono">{item.revision}</div></div>
            {item.remarks && <div className="wide"><div className="k">Remarks or exceptions</div><div className="v">{item.remarks}</div></div>}
          </div>
        )}
      </Section>

      {item && (
        <>
          <Section title="Confirmations (D-053)">
            {item.m_procedure && <Check checked={mDone} onChange={setMDone}>(M) maintenance procedure done</Check>}
            {item.o_procedure && <Check checked={oPassed} onChange={setOPassed}>(O) procedure passed to Operations</Check>}
            <Check checked={placard} onChange={setPlacard}>Placard fitted</Check>
          </Section>
          <TlbFields book={tlb.book} page={tlb.page} item={tlb.item} onChange={change} />
          <Section title="Sign">
            <p className="small" style={{ margin: 0 }}>Applying the item places it on the DDLS automatically (D-053, D-163).</p>
            <label htmlFor="mel-remarks" style={{ margin: 0 }}>Remarks <span className="hint">(optional)</span></label>
            <input id="mel-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <SvcMelOption snag={snag} checked={svcMel} onChange={setSvcMel} />
            <PinField value={pin} onChange={setPin} />
            <Submit busy={busy} error={error} label="Sign and apply MEL" onCancel={onCancel} />
          </Section>
        </>
      )}
      {!item && <div className="action-row"><button type="button" className="outline-button" onClick={onCancel}>Cancel</button></div>}
    </form>
  );
}

// Defer on DDLS, not MEL (WF-DD2).
function DdlsForm({ snag, onDone, onCancel }: FormProps) {
  const [days, setDays] = useState('');
  const [ref, setRef] = useState('');
  const [mReq, setMReq] = useState(false);
  const [oReq, setOReq] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [pin, setPin] = useState('');
  const [svcMel, setSvcMel] = useSvcMel(snag);
  const { tlb, change, args } = useTlb(snag);
  const { error, busy, run } = useSubmit(onDone);

  function submit(e: FormEvent) {
    e.preventDefault();
    run(
      () => {
        if (!/^[0-9]+$/.test(days) || Number(days) < 1) return 'Enter the days allowed (a whole number).';
        if (!ref.trim()) return 'Days allowed must carry a manual reference (AMM, SRM…) (D-163).';
        return pinOk(pin);
      },
      async () => {
        const label = `Defer ${snag.number} on the DDLS (${days} days)`;
        const { data, error: err, queued } = await perform('defer_on_ddls', {
          p_snag: snag.id, p_days_allowed: Number(days), p_manual_reference: ref.trim(), p_pin: pin,
          p_m_required: mReq, p_o_required: oReq, p_remarks: remarks.trim() || undefined, ...args,
          p_set_svc_mel: svcMel,
        }, { label: label, recordPath: `/snags/${snag.id}`, aircraftId: snag.aircraft_id });
        if (err) return { error: err };
        if (queued) return { error: null, message: queuedText({ queued }, label) };
        const { data: d } = await db.from('ddls_entry').select('page_no, entry_no').eq('id', data as string).maybeSingle();
        return { error: null, message: `Deferred on the DDLS${d ? `, page ${d.page_no} entry ${d.entry_no}` : ''}.${statusMessage(svcMel, snag.tail)}` };
      },
    );
  }
  return (
    <form className="disp-form" onSubmit={submit}>
      <TlbFields book={tlb.book} page={tlb.page} item={tlb.item} onChange={change} />
      <Section title={<>Defer on DDLS (not MEL) · <span className="mono">{snag.tail}</span></>} tone="strong">
        <p className="small muted" style={{ margin: 0 }}>
          Airworthiness-related deferred defect not covered by the MEL · certifying engineer · PIN.
        </p>
        {snag.description && (
          <div>
            <div className="label" style={{ marginTop: 0 }}>Pilot report or maintenance entry</div>
            <div className="report-quote">{snag.description}</div>
          </div>
        )}
        <div className="field-grid two">
          <div>
            <label htmlFor="ddls-days">Days allowed <span className="hint">(required)</span></label>
            <input id="ddls-days" className="mono" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} required />
          </div>
          <div>
            <label htmlFor="ddls-ref">Manual reference <span className="hint">(required)</span></label>
            <input id="ddls-ref" className="mono" placeholder="e.g. AMM 21-31-00" value={ref} onChange={(e) => setRef(e.target.value)} required />
          </div>
        </div>
        {/* The due time is worked out by the database from the engineer's
            figures; the screen does not project it (D-020, D-021). */}
        <p className="small muted" style={{ margin: 0 }}>Counted in calendar days from now, ending 23:59 on the last day (operator time).</p>
      </Section>
      <Section title="Procedures">
        <Check checked={mReq} onChange={setMReq}>(M) maintenance action required</Check>
        <Check checked={oReq} onChange={setOReq}>(O) operational limitation required</Check>
        <p className="small muted" style={{ margin: 0 }}>A procedure not required prints as N/A.</p>
      </Section>
      <Section title="Sign">
        <label htmlFor="ddls-remarks" style={{ margin: 0 }}>Remarks <span className="hint">(optional)</span></label>
        <input id="ddls-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        <SvcMelOption snag={snag} checked={svcMel} onChange={setSvcMel} />
        <PinField value={pin} onChange={setPin} />
        <Submit busy={busy} error={error} label="Sign and place on DDLS" onCancel={onCancel} />
      </Section>
    </form>
  );
}

type Zone = { code: string; name: string; is_emergency_equipment: boolean };

function NaddForm({ snag, onDone, onCancel }: FormProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zone, setZone] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState('');
  const [declared, setDeclared] = useState(false);
  const [pin, setPin] = useState('');
  const { error, busy, run } = useSubmit(onDone);

  useEffect(() => {
    cached(`zones:${snag.aircraft_type}`, () => db.from('cabin_zone').select('code, name, is_emergency_equipment')
      .eq('aircraft_type_code', snag.aircraft_type).order('code'))
      .then(({ data }) => setZones((data ?? []) as Zone[]));
  }, [snag.aircraft_type]);

  function submit(e: FormEvent) {
    e.preventDefault();
    run(
      () => {
        if (limit && !/^[0-9]+$/.test(limit)) return 'The limit is a whole number of days.';
        if (!declared) return 'Confirm the item is not covered by the MEL and has no airworthiness effect (D-160).';
        return pinOk(pin);
      },
      async () => {
        const label = `Defer ${snag.number} as a NADD`;
        const { data, error: err, queued } = await perform('defer_as_nadd', {
          p_snag: snag.id, p_pin: pin, p_declaration: declared,
          p_zone: zone || undefined, p_location: location.trim() || undefined,
          p_limit_days: limit ? Number(limit) : undefined,
        }, { label: label, recordPath: `/snags/${snag.id}`, aircraftId: snag.aircraft_id });
        if (err) return { error: err };
        if (queued) return { error: null, message: queuedText({ queued }, label) };
        const { data: n } = await db.from('nadd').select('number').eq('id', data as string).maybeSingle();
        return { error: null, message: `Deferred as ${n?.number ?? 'a NADD'}.` };
      },
    );
  }
  return (
    <form className="disp-form" onSubmit={submit}>
      <Section title={<>Defer as NADD · <span className="mono">{snag.tail}</span></>} tone="strong">
        <div className="field-grid two">
          <div>
            <label htmlFor="nadd-zone">Cabin zone <span className="hint">(optional)</span></label>
            <select id="nadd-zone" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Not a cabin item / not listed</option>
              {zones.map((z) => (
                <option key={z.code} value={z.code} disabled={z.is_emergency_equipment}>
                  {z.name}{z.is_emergency_equipment ? ' (emergency equipment: never a NADD)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nadd-location">Location <span className="hint">(optional, e.g. seat 3A)</span></label>
            <input id="nadd-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
        <label htmlFor="nadd-limit">Limit in days <span className="hint">(leave blank for the operator default; shorter only)</span></label>
        <input id="nadd-limit" className="mono" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ''))} />
        <p className="small muted" style={{ margin: 0 }}>Counted from when the defect was reported (D-048).</p>
      </Section>
      <Section title="Sign">
        <Check checked={declared} onChange={setDeclared}>
          I confirm this item is not covered by the MEL and has no effect on airworthiness (D-160).
        </Check>
        <PinField value={pin} onChange={setPin} />
        <Submit busy={busy} error={error} label="Sign and defer as NADD" onCancel={onCancel} />
      </Section>
    </form>
  );
}
