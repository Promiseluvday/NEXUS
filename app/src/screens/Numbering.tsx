// Administration ▸ Numbering (D-064, D-220): how this operator numbers its
// documents. Super Admins and Quality.
//
//   Operator codes   {ORG} (e.g. the operator's 3LC), {UNIT} (unit or station
//                    code) and how a corrected work order shows its revision
//                    ("{NUMBER} R{REV}" → WO-000002 R1)
//   Documents        each numbered document, its format and the next number.
//                    Pick a suggested structure or type your own; the preview
//                    comes from the database, which checks the format.
//
// Changes apply to new documents only: numbers already issued never change
// (D-023). Every change needs a reason and the PIN and is kept with who and
// when. The database checks the rules again.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { actions, db, errorText, hideRefs } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import { PinField } from '../components/PinField';
import { Crumbs, PageHead, Section } from '../components/PageFrame';

type DocRow = {
  series: string; label: string; code: string; format: string; next_number: string;
  version: number | null; changed_by: string | null; changed_at: string | null; reason: string | null;
};

// Suggested structures. "§" stands for the document's own code (WO, SNAG, PR …).
const SUGGESTIONS = [
  '{ORG}/{YYYY}/§/{0000}',
  '{ORG}{YYYY}/§/{0000}',
  '{YYYY}/{ORG}/§/{0000}',
  '{ORG}/{UNIT}/§/{YYYY}/{0000}',
  '{UNIT}/§/{YYYY}/{0000}',
  '{ORG}{UNIT}§{YY}{00}',
  '{UNIT}§{YY}{00}',
  '{ORG}{UNIT}{0000}',
  '§-{000000}',
];

const PLACEHOLDERS: [string, string][] = [
  ['{ORG}', 'operator code'],
  ['{UNIT}', 'unit or station code'],
  ['{YYYY} / {YY}', 'year, 2026 / 26 (the number starts again each January)'],
  ['{MM}', 'month (with a year)'],
  ['{TAIL}', 'the tail (work orders only)'],
  ['{0000}', 'running number; the zeros set the width. {0035} = continue from 35'],
];

export function mayManageNumbering(me: { adminDepartments?: string[]; departments: { code: string }[] } | null): boolean {
  return Boolean(me && ((me.adminDepartments?.length ?? 0) > 0 || me.departments.some((d) => d.code === 'QUA')));
}

function useSettingText(key: string, reload: number): string {
  const [v, setV] = useState('');
  useEffect(() => {
    db.from('operator_setting_current').select('value').eq('key', key).maybeSingle()
      .then(({ data }) => {
        const value = (data as { value?: unknown } | null)?.value;
        setV(typeof value === 'string' ? value : '');
      });
  }, [key, reload]);
  return v;
}

export function AdminNumbering() {
  const { me, display } = useAuth();
  const [rows, setRows] = useState<DocRow[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const org = useSettingText('operator.code', reload);
  const unit = useSettingText('operator.unit_code', reload);
  const revision = useSettingText('work_order.revision_format', reload);

  const load = useCallback(() => {
    actions.rpc('numbering_settings').then(({ data, error: err }) => {
      if (err) setError(errorText(err));
      setRows((data ?? []) as DocRow[]);
    });
  }, []);
  useEffect(() => { load(); }, [load, reload]);
  const done = (m: string) => { setMessage(m); setEditing(null); setReload((n) => n + 1); };

  if (!mayManageNumbering(me)) {
    return <div className="page"><p>Numbering is set by Super Admins and Quality.</p></div>;
  }
  const doc = rows?.find((r) => r.series === editing);

  return (
    <div className="page">
      <Crumbs items={[{ label: 'Administration' }, { label: 'Numbering' }]} />
      <PageHead title="Numbering"
        sub="How each document is numbered. Changes apply to new documents only: numbers already issued never change." />
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <CodesBox org={org} unit={unit} revision={revision} onDone={done} />

      <Section title="Documents">
        {rows === null ? <p className="muted">Loading…</p> : (
          <div className="table-scroll">
            <table className="board">
              <thead><tr><th>Document</th><th>Format</th><th>Next number</th><th>Last changed</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.series}>
                    <td>{r.label}</td>
                    <td className="mono">{r.format}</td>
                    <td className="mono">{r.next_number}</td>
                    <td className="small">
                      {r.changed_at
                        ? <>{r.changed_by ? <span className="mono">{r.changed_by}</span> : 'Set-up'} · {formatDateTime(r.changed_at, display)}{r.reason && <> · {hideRefs(r.reason)}</>}</>
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      <button type="button" className="outline-button" onClick={() => setEditing(r.series)}>Change</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {doc && <FormatEditor key={doc.series} doc={doc} onCancel={() => setEditing(null)} onDone={done} />}
    </div>
  );
}

// Operator code, unit code and the revision style.
function CodesBox({ org, unit, revision, onDone }: {
  org: string; unit: string; revision: string; onDone: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [o, setO] = useState('');
  const [u, setU] = useState('');
  const [r, setR] = useState('');
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const start = () => { setO(org); setU(unit); setR(revision); setReason(''); setPin(''); setError(''); setOpen(true); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return setError('Give a reason for the change.');
    const changes = ([['operator.code', o.trim().toUpperCase(), org], ['operator.unit_code', u.trim().toUpperCase(), unit],
      ['work_order.revision_format', r.trim(), revision]] as const).filter(([, now, was]) => now !== was);
    if (!changes.length) return setError('Nothing has changed.');
    setBusy(true);
    for (const [key, value] of changes) {
      const { error: err } = await actions.rpc('set_numbering_setting', { p_key: key, p_value: value, p_reason: reason.trim(), p_pin: pin });
      if (err) { setBusy(false); return setError(errorText(err)); }
    }
    setBusy(false);
    setOpen(false);
    onDone('Codes saved. New documents use them from now on.');
  }

  return (
    <Section title="Operator codes"
      actions={!open && <button type="button" className="outline-button" onClick={start}>Change</button>}>
      {!open ? (
        <dl className="facts">
          <dt>Operator code <span className="mono">{'{ORG}'}</span></dt><dd className="mono">{org || '—'}</dd>
          <dt>Unit / station code <span className="mono">{'{UNIT}'}</span></dt><dd className="mono">{unit || '—'}</dd>
          <dt>Corrected work order</dt>
          <dd><span className="mono">{revision || '{NUMBER} R{REV}'}</span> · e.g. <span className="mono">
            {(revision || '{NUMBER} R{REV}').replace('{NUMBER}', 'WO-000002').replace('{REV}', '1')}</span></dd>
        </dl>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="nb-org" style={{ marginTop: 0 }}>Operator code <span className="hint">(letters and digits, e.g. your 3LC)</span></label>
          <input id="nb-org" className="mono" value={o} maxLength={10} onChange={(e) => setO(e.target.value.toUpperCase())} />
          <label htmlFor="nb-unit">Unit / station code <span className="hint">(letters and digits)</span></label>
          <input id="nb-unit" className="mono" value={u} maxLength={10} onChange={(e) => setU(e.target.value.toUpperCase())} />
          <label htmlFor="nb-rev">Corrected work order <span className="hint">({'{NUMBER}'} and {'{REV}'}, e.g. {'"{NUMBER} R{REV}"'} or {'"{NUMBER}-R{REV}"'})</span></label>
          <input id="nb-rev" className="mono" value={r} maxLength={30} onChange={(e) => setR(e.target.value)} />
          <div className="small muted">Shows as <span className="mono">{r.replace('{NUMBER}', 'WO-000002').replace('{REV}', '1')}</span></div>
          <label htmlFor="nb-codes-reason">Reason <span className="hint">(required; kept with the change)</span></label>
          <input id="nb-codes-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <PinField id="nb-codes-pin" value={pin} onChange={setPin} />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="action-row">
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Sign and save'}</button>
            <button type="button" className="outline-button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </Section>
  );
}

// Change one document's format: suggestions, or type your own.
function FormatEditor({ doc, onCancel, onDone }: { doc: DocRow; onCancel: () => void; onDone: (m: string) => void }) {
  const [format, setFormat] = useState(doc.format);
  const [preview, setPreview] = useState(doc.next_number);
  const [problem, setProblem] = useState('');
  const [examples, setExamples] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const suggestions = SUGGESTIONS.map((s) => s.split('§').join(doc.code));

  // What each suggestion would look like, from the database.
  useEffect(() => {
    Promise.all(suggestions.map((s) => actions.rpc('preview_number', { p_series: doc.series, p_format: s })))
      .then((res) => setExamples(Object.fromEntries(res.map((r, i) => [suggestions[i], (r.data as string | null) ?? '']))));
  }, [doc.series]);

  // Live preview as the format is typed; the database checks it.
  useEffect(() => {
    const t = setTimeout(() => {
      actions.rpc('preview_number', { p_series: doc.series, p_format: format }).then(({ data, error: err }) => {
        setProblem(err ? errorText(err) : '');
        setPreview(err ? '' : (data as string));
      });
    }, 250);
    return () => clearTimeout(t);
  }, [format, doc.series]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (problem) return setError(problem);
    if (format.trim() === doc.format) return setError('Nothing has changed.');
    if (!reason.trim()) return setError('Give a reason for the change.');
    setBusy(true);
    const { data, error: err } = await actions.rpc('set_numbering_setting', {
      p_key: `${doc.series}.number_format`, p_value: format.trim(), p_reason: reason.trim(), p_pin: pin,
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone(`${doc.label}: the next one will be ${data as string}.`);
  }

  return (
    <form onSubmit={submit}>
      <Section title={`${doc.label} · number format`} tone="strong">
        <p className="small muted" style={{ marginTop: 0 }}>Pick a structure or type your own.</p>
        <div className="chip-row" style={{ marginTop: 0 }}>
          {suggestions.map((s) => (
            <button key={s} type="button" className={`outline-button${s === format ? ' active' : ''}`}
              onClick={() => setFormat(s)} title={s}>
              <span className="mono">{examples[s] || s}</span>
            </button>
          ))}
        </div>
        <label htmlFor="nb-format">Format</label>
        <input id="nb-format" className="mono" value={format} maxLength={40} onChange={(e) => setFormat(e.target.value)} />
        <div className="small" role="status">
          {problem ? <span style={{ color: 'var(--aog)' }}>{problem}</span> : <>Next number: <strong className="mono">{preview}</strong></>}
        </div>
        <dl className="facts small">
          {PLACEHOLDERS.filter(([p]) => p !== '{TAIL}' || doc.series === 'work_order').map(([p, what]) => (
            <div key={p} style={{ display: 'contents' }}><dt className="mono">{p}</dt><dd>{what}</dd></div>
          ))}
        </dl>
        <p className="panel-note">Letters, digits and / - . _ only. Numbers already issued stay as they are.</p>
        <label htmlFor="nb-reason">Reason <span className="hint">(required; kept with the change)</span></label>
        <input id="nb-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Quality manual revision 4" />
        <PinField id="nb-pin" value={pin} onChange={setPin} />
        {error && <div className="error" role="alert">{error}</div>}
        <div className="action-row">
          <button type="submit" disabled={busy || Boolean(problem)}>{busy ? 'Saving…' : 'Sign and save'}</button>
          <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
        </div>
      </Section>
    </form>
  );
}
