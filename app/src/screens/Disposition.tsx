// The five dispositions of an attended snag (D-040, D-214):
//
//   Rectify now      → request a work order (Quality, then CO approve: D-063)
//   Defer under MEL  → choose the item, confirm (M), (O) and placard, sign;
//                      logged on the DDLS automatically (D-053, D-163)
//   Defer on DDLS    → not an MEL item: days allowed with a manual reference
//   Defer as NADD    → no airworthiness effect, not emergency equipment (D-160, D-209)
//   No fault found   → record what was checked, sign; closes the snag
//
// One dropdown picks the disposition; only that form shows (docs/ui-rules.md).
// Signing needs a certifying engineer for the type and their PIN (D-043,
// D-094). The DATABASE checks all of this again; the screen only guides.
// The limits shown are the ones the MEL or the engineer state. Nexus never
// decides airworthiness (D-020).
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { actions, db, errorText } from '../lib/supabase';
import { PinField } from '../components/PinField';
import { MelSearch, melInterval, type MelItem } from '../components/MelSearch';

export type SnagForDisposition = {
  id: string;
  number: string;
  aircraft_id: string;
  aircraft_type: string;
  tlb_book: string | null;
  tlb_page: string | null;
  tlb_item: string | null;
};

type Kind = 'rectify_now' | 'mel' | 'ddls' | 'nadd' | 'nff';

const KINDS: { key: Kind; label: string; signs: boolean }[] = [
  { key: 'rectify_now', label: 'Rectify now: request a work order', signs: false },
  { key: 'mel', label: 'Defer under the MEL', signs: true },
  { key: 'ddls', label: 'Defer on the DDLS (not an MEL item)', signs: true },
  { key: 'nadd', label: 'Defer as a NADD (no airworthiness effect)', signs: true },
  { key: 'nff', label: 'No fault found: close', signs: true },
];

type Props = {
  snag: SnagForDisposition;
  canCertify: boolean;
  onDone: (message: string) => void;
  onChoose?: () => void; // clears any earlier message when a disposition is picked
};

export function Disposition({ snag, canCertify, onDone, onChoose }: Props) {
  const [kind, setKind] = useState<Kind | ''>('');
  const chosen = KINDS.find((k) => k.key === kind);

  return (
    <div className="card">
      <h2>Disposition</h2>
      <label htmlFor="disposition">What will be done with this snag?</label>
      <select id="disposition" value={kind} onChange={(e) => { setKind(e.target.value as Kind); onChoose?.(); }}>
        <option value="">Choose a disposition…</option>
        {KINDS.map((k) => (
          <option key={k.key} value={k.key}>{k.label}{k.signs && !canCertify ? ' (certifying engineer)' : ''}</option>
        ))}
      </select>
      {chosen?.signs && !canCertify && (
        <div className="notice">
          This needs a certifying engineer for the {snag.aircraft_type} (D-043). You do not hold a valid
          authorization for this type, so the database will refuse your signature. Ask a certifying engineer,
          or request a work order.
        </div>
      )}
      {kind === 'rectify_now' && <WorkOrderForm snag={snag} onDone={onDone} />}
      {kind === 'mel' && <MelForm snag={snag} onDone={onDone} />}
      {kind === 'ddls' && <DdlsForm snag={snag} onDone={onDone} />}
      {kind === 'nadd' && <NaddForm snag={snag} onDone={onDone} />}
      {kind === 'nff' && <NffForm snag={snag} onDone={onDone} />}
    </div>
  );
}

// ---------------------------------------------------------------- helpers

type FormProps = { snag: SnagForDisposition; onDone: (message: string) => void };

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

function Submit({ busy, label, error }: { busy: boolean; label: string; error: string }) {
  return (
    <>
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Sending…' : label}</button></p>
    </>
  );
}

// Tech log reference (D-164), filled in from the report and correctable.
function TlbFields({ book, page, item, onChange, withItem = true }: {
  book: string; page: string; item?: string; withItem?: boolean;
  onChange: (k: 'book' | 'page' | 'item', v: string) => void;
}) {
  return (
    <div className="row">
      <div><label htmlFor="tlb-book">Tech log book</label>
        <input id="tlb-book" className="mono" value={book} onChange={(e) => onChange('book', e.target.value)} /></div>
      <div><label htmlFor="tlb-page">Page</label>
        <input id="tlb-page" className="mono" value={page} onChange={(e) => onChange('page', e.target.value)} /></div>
      {withItem && <div><label htmlFor="tlb-item">Item</label>
        <input id="tlb-item" className="mono" value={item ?? ''} onChange={(e) => onChange('item', e.target.value)} /></div>}
    </div>
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
const STATUS_HINT = ' The tail status is unchanged: set it below if it should change (e.g. Serviceable · MEL).';

const pinOk = (pin: string) => (/^[0-9]{4,8}$/.test(pin) ? null : 'Enter your PIN (4 to 8 digits) to sign.');

// ------------------------------------------------------------ the forms

function WorkOrderForm({ snag, onDone }: FormProps) {
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
      <label htmlFor="wo-scope">Work to be done</label>
      <textarea id="wo-scope" value={scope} onChange={(e) => setScope(e.target.value)} required />
      <label htmlFor="wo-hours">Estimated man-hours <span className="hint">(optional)</span></label>
      <input id="wo-hours" type="number" min="0" step="0.5" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
      <p className="small muted">No signature yet: the work order goes to Quality, then the CO. Work is recorded and certified on the work order.</p>
      <Submit busy={busy} error={error} label="Request work order" />
    </form>
  );
}

function MelForm({ snag, onDone }: FormProps) {
  const [item, setItem] = useState<MelItem | null>(null);
  const [mDone, setMDone] = useState(false);
  const [oPassed, setOPassed] = useState(false);
  const [placard, setPlacard] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [pin, setPin] = useState('');
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
        const { data, error: err } = await actions.rpc('apply_mel', {
          p_snag: snag.id, p_mel_item: item!.id, p_pin: pin,
          p_m_done: mDone, p_o_passed: oPassed, p_placard_fitted: placard,
          p_remarks: remarks.trim() || undefined, ...args,
        });
        if (err) return { error: err };
        const { data: d } = await db.from('ddls_entry').select('page_no, entry_no').eq('id', data as string).maybeSingle();
        return { error: null, message: `Deferred under MEL ${item!.item_number}. Logged on the DDLS${d ? `, page ${d.page_no} entry ${d.entry_no}` : ''}.${STATUS_HINT}` };
      },
    );
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="mel-search">MEL item</label>
      <MelSearch aircraftId={snag.aircraft_id} value={item} onChange={(i) => { setItem(i); setMDone(false); setOPassed(false); }} />
      {item && (
        <>
          <p className="small">Limit as stated in the MEL: <strong>{melInterval(item)}</strong>, category {item.category}.</p>
          {item.m_procedure && <Check checked={mDone} onChange={setMDone}>(M) maintenance procedure done</Check>}
          {item.o_procedure && <Check checked={oPassed} onChange={setOPassed}>(O) procedure passed to Operations</Check>}
          <Check checked={placard} onChange={setPlacard}>Placard fitted</Check>
          <label htmlFor="mel-remarks">Remarks <span className="hint">(optional)</span></label>
          <input id="mel-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          <TlbFields book={tlb.book} page={tlb.page} item={tlb.item} onChange={change} />
          <PinField value={pin} onChange={setPin} />
          <Submit busy={busy} error={error} label="Sign and defer under MEL" />
        </>
      )}
    </form>
  );
}

function DdlsForm({ snag, onDone }: FormProps) {
  const [days, setDays] = useState('');
  const [ref, setRef] = useState('');
  const [mReq, setMReq] = useState(false);
  const [oReq, setOReq] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [pin, setPin] = useState('');
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
        const { data, error: err } = await actions.rpc('defer_on_ddls', {
          p_snag: snag.id, p_days_allowed: Number(days), p_manual_reference: ref.trim(), p_pin: pin,
          p_m_required: mReq, p_o_required: oReq, p_remarks: remarks.trim() || undefined, ...args,
        });
        if (err) return { error: err };
        const { data: d } = await db.from('ddls_entry').select('page_no, entry_no').eq('id', data as string).maybeSingle();
        return { error: null, message: `Deferred on the DDLS${d ? `, page ${d.page_no} entry ${d.entry_no}` : ''}.${STATUS_HINT}` };
      },
    );
  }
  return (
    <form onSubmit={submit}>
      <div className="row">
        <div>
          <label htmlFor="ddls-days">Days allowed</label>
          <input id="ddls-days" className="mono" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} required />
        </div>
        <div>
          <label htmlFor="ddls-ref">Manual reference</label>
          <input id="ddls-ref" className="mono" placeholder="e.g. AMM 21-31-00" value={ref} onChange={(e) => setRef(e.target.value)} required />
        </div>
      </div>
      <p className="small muted">Counted in calendar days from now, ending 23:59 on the last day (operator time).</p>
      <Check checked={mReq} onChange={setMReq}>(M) maintenance action required</Check>
      <Check checked={oReq} onChange={setOReq}>(O) operational limitation required</Check>
      <label htmlFor="ddls-remarks">Remarks <span className="hint">(optional)</span></label>
      <input id="ddls-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      <TlbFields book={tlb.book} page={tlb.page} item={tlb.item} onChange={change} />
      <PinField value={pin} onChange={setPin} />
      <Submit busy={busy} error={error} label="Sign and defer on DDLS" />
    </form>
  );
}

type Zone = { code: string; name: string; is_emergency_equipment: boolean };

function NaddForm({ snag, onDone }: FormProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zone, setZone] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState('');
  const [declared, setDeclared] = useState(false);
  const [pin, setPin] = useState('');
  const { error, busy, run } = useSubmit(onDone);

  useEffect(() => {
    db.from('cabin_zone').select('code, name, is_emergency_equipment')
      .eq('aircraft_type_code', snag.aircraft_type).order('code')
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
        const { data, error: err } = await actions.rpc('defer_as_nadd', {
          p_snag: snag.id, p_pin: pin, p_declaration: declared,
          p_zone: zone || undefined, p_location: location.trim() || undefined,
          p_limit_days: limit ? Number(limit) : undefined,
        });
        if (err) return { error: err };
        const { data: n } = await db.from('nadd').select('number').eq('id', data as string).maybeSingle();
        return { error: null, message: `Deferred as ${n?.number ?? 'a NADD'}.` };
      },
    );
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="nadd-zone">Cabin zone <span className="hint">(optional)</span></label>
      <select id="nadd-zone" value={zone} onChange={(e) => setZone(e.target.value)}>
        <option value="">Not a cabin item / not listed</option>
        {zones.map((z) => (
          <option key={z.code} value={z.code} disabled={z.is_emergency_equipment}>
            {z.name}{z.is_emergency_equipment ? ' (emergency equipment: never a NADD)' : ''}
          </option>
        ))}
      </select>
      <label htmlFor="nadd-location">Location <span className="hint">(optional, e.g. seat 3A)</span></label>
      <input id="nadd-location" value={location} onChange={(e) => setLocation(e.target.value)} />
      <label htmlFor="nadd-limit">Limit in days <span className="hint">(leave blank for the operator default; shorter only)</span></label>
      <input id="nadd-limit" className="mono" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ''))} />
      <p className="small muted">Counted from when the defect was reported (D-048).</p>
      <Check checked={declared} onChange={setDeclared}>
        I confirm this item is not covered by the MEL and has no effect on airworthiness (D-160).
      </Check>
      <PinField value={pin} onChange={setPin} />
      <Submit busy={busy} error={error} label="Sign and defer as NADD" />
    </form>
  );
}

function NffForm({ snag, onDone }: FormProps) {
  const [findings, setFindings] = useState('');
  const [pin, setPin] = useState('');
  const { tlb, change } = useTlb(snag);
  const { error, busy, run } = useSubmit(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(
      () => (findings.trim() ? pinOk(pin) : 'Record what was checked before closing as no fault found.'),
      async () => {
        const { error: err } = await actions.rpc('close_snag_no_fault_found', {
          p_snag: snag.id, p_findings: findings.trim(), p_pin: pin,
          p_tlb_book: tlb.book || undefined, p_tlb_page: tlb.page || undefined,
        });
        return err ? { error: err } : { error: null, message: `${snag.number} closed: no fault found.` };
      },
    );
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="nff-findings">What was checked, and the result</label>
      <textarea id="nff-findings" value={findings} onChange={(e) => setFindings(e.target.value)} required />
      <TlbFields book={tlb.book} page={tlb.page} onChange={change} withItem={false} />
      <PinField value={pin} onChange={setPin} />
      <Submit busy={busy} error={error} label="Sign and close" />
    </form>
  );
}
