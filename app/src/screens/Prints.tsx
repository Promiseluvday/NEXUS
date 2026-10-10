// Printable DDLS and NADDS (D-049, D-097, D-161, workflows/ddls.md, nadd.md),
// laid out as the Claude Design wireframes WF-PRD and WF-PRN.
//
// Opened in a new tab without the app frame, laid out for A4 landscape, black
// on white; the browser's Print button (or "Save as PDF") produces the sheet.
// The dark bar at the top is the print preview bar: it never prints. Every
// sheet carries "Printed from Nexus MRO · time · by whom · uncontrolled when
// printed": the electronic record is the master (D-023). Anything signed
// offline on this tablet and not yet checked by the server is listed as
// "Signed offline · awaiting server check" (D-217).
//
// The layout is Liebetag's first template, built from the field lists in the
// workflow write-ups, not from any operator's real form (D-112, D-113). The
// operator's name, form numbers, DDLS entries per page and NADDS foot
// remarks are settings (D-025). The operator's crest is uploaded by the
// operator (D-161); until uploads of it exist an empty crest box is shown.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import { useOutbox } from '../lib/offline/hooks';
import { formatDate, formatDateTime } from '../lib/format';
import { DDLS_SELECT, limitText, type DdlsEntry } from './Ddls';
import { NADD_SELECT, type Nadd } from './Nadds';

type Settings = { operator: string; ddlsForm: string; naddsForm: string; naddsRemarks: string[]; perPage: number };

function usePrintBasics() {
  const { id } = useParams();
  const [aircraft, setAircraft] = useState<{ tail: string; aircraft_type_code: string } | null>(null);
  const [settings, setSettings] = useState<Settings>({ operator: '', ddlsForm: '', naddsForm: '', naddsRemarks: [], perPage: 4 });
  const printedAt = useState(() => new Date())[0];
  useEffect(() => {
    db.from('aircraft').select('tail, aircraft_type_code').eq('id', id!).maybeSingle().then(({ data }) => setAircraft(data));
    db.from('operator_setting_current').select('key, value')
      .in('key', ['operator.name', 'print.ddls_form_number', 'print.nadds_form_number', 'print.nadds_remarks', 'ddls.entries_per_page'])
      .then(({ data }) => {
        const get = (k: string) => data?.find((r) => r.key === k)?.value;
        setSettings({
          operator: (get('operator.name') as string) ?? '',
          ddlsForm: (get('print.ddls_form_number') as string) ?? '',
          naddsForm: (get('print.nadds_form_number') as string) ?? '',
          naddsRemarks: (get('print.nadds_remarks') as string[]) ?? [],
          perPage: Number(get('ddls.entries_per_page') ?? 4) || 4,
        });
      });
  }, [id]);
  return { id: id!, aircraft, settings, printedAt };
}

// The preview bar (never printed) and the sheets under it.
function PrintFrame({ title, back, children }: { title: string; back: { to: string; label: string }; children: ReactNode }) {
  useEffect(() => { document.title = title; }, [title]);
  return (
    <div className="print-page pr-page">
      <div className="pr-bar no-print">
        <Link to={back.to}>← Back to {back.label}</Link>
        <span className="pr-bar-note">Print preview · A4 landscape · this bar does not print</span>
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" className="pr-bar-ghost" onClick={() => window.print()} title="In the print window choose “Save as PDF”">Download PDF</button>
      </div>
      {children}
    </div>
  );
}

function PrintHead({ settings, title, short, form, children }: { settings: Settings; title: string; short: string; form: string; children: ReactNode }) {
  return (
    <header className="pr-head">
      <div className="pr-crest-wrap">
        <div className="pr-crest" aria-label="Operator crest">{settings.operator ? '' : 'Operator crest'}</div>
        <div className="pr-op">
          {settings.operator && <strong>{settings.operator}</strong>}
          {form && <div>{form}</div>}
        </div>
      </div>
      <div className="pr-title"><h1>{title}</h1><div>{short}</div></div>
      <div className="pr-ids">{children}</div>
    </header>
  );
}

// Offline signatures for this tail that the server has not yet checked (D-217).
function Provisional({ aircraftId, actionNames }: { aircraftId: string; actionNames: string[] }) {
  const items = useOutbox().filter((i) => i.status !== 'sent' && i.kind === 'signed' && i.aircraftId === aircraftId && actionNames.includes(i.action));
  if (items.length === 0) return null;
  return (
    <div className="pr-provisional">
      <strong>Signed offline · awaiting server check (D-217):</strong> {items.map((i) => i.label).join(' · ')}
    </div>
  );
}

function PrintFoot({ printedAt, page, pages, note }: { printedAt: Date; page: number; pages: number; note?: string }) {
  const { me, display } = useAuth();
  return (
    <>
      {note && <div className="pr-note">{note}</div>}
      <div className="print-foot pr-foot">
        Printed from Nexus MRO · {formatDateTime(printedAt, display)} · by {me?.fullName} ({me?.tlc}) · sheet {page} of {pages} ·
        uncontrolled when printed: the electronic record is the master
      </div>
    </>
  );
}

const who = (p: { three_letter_code: string } | null) => p?.three_letter_code ?? '';
const join = (sep: string, ...v: (string | null | undefined)[]) => v.filter(Boolean).join(sep);

// One labelled box of the DDLS form: a small label above the value.
function Cell({ label, children, ...rest }: { label: string; children?: ReactNode; colSpan?: number; className?: string }) {
  return <td {...rest}><div className="pr-label">{label}</div><div className="pr-val">{children}</div></td>;
}

// ------------------------------------------------------------------ DDLS
export function DdlsPrint() {
  const { display } = useAuth();
  const { id, aircraft, settings, printedAt } = usePrintBasics();
  const [entries, setEntries] = useState<DdlsEntry[] | null>(null);
  useEffect(() => {
    db.from('ddls_entry').select(DDLS_SELECT).eq('aircraft_id', id).order('page_no').order('entry_no')
      .then(({ data }) => setEntries((data ?? []) as unknown as DdlsEntry[]));
  }, [id]);
  if (!entries || !aircraft) return <div className="print-page">Preparing…</div>;
  const pages = [...new Set(entries.map((e) => e.page_no))];
  const d = (v: string | null) => formatDate(v, display);
  const back = { to: `/ddls?aircraft=${id}`, label: 'DDLS' };

  return (
    <PrintFrame title={`DDLS ${aircraft.tail}`} back={back}>
      {pages.length === 0 && <p>No DDLS entries on {aircraft.tail}.</p>}
      {pages.map((page, i) => {
        const list = entries.filter((e) => e.page_no === page);
        // The page always shows its full number of entry boxes, blank ones included.
        const slots: (DdlsEntry | null)[] = Array.from({ length: Math.max(settings.perPage, list.length) },
          (_, k) => list.find((e) => e.entry_no === k + 1) ?? null);
        list.filter((e) => e.entry_no > slots.length).forEach((e) => slots.push(e));
        const closed = list.every((e) => e.status === 'cleared');
        return (
          <section key={page} className="print-sheet pr-sheet">
            <PrintHead settings={settings} title="Deferred Defects Log Sheet" short="DDLS" form={settings.ddlsForm}>
              <div>Aircraft type: <strong>{aircraft.aircraft_type_code}</strong></div>
              <div>Registration: <strong className="mono">{aircraft.tail}</strong></div>
              <div>Page No.: <strong className="mono">{String(page).padStart(2, '0')}</strong>{closed && ' · page closed'}</div>
            </PrintHead>
            <Provisional aircraftId={id} actionNames={['apply_mel', 'defer_on_ddls', 'clear_ddls_entry', 'certify_work_order']} />
            {slots.map((e, k) => {
              const ext = e?.extensions.filter((x) => x.status !== 'rejected').slice(-1)[0];
              return (
                <table key={e?.id ?? `blank-${k}`} className="pr-entry">
                  <tbody>
                    <tr>
                      <td rowSpan={3} className="pr-no">{e?.entry_no ?? k + 1}</td>
                      <Cell label="TLB Book / Page / Item"><span className="mono">{e && join(' / ', e.tlb_book, e.tlb_page, e.tlb_item)}</span></Cell>
                      <Cell label="MEL Cat">{e ? (e.kind === 'mel' ? e.mel_category : '—') : ''}</Cell>
                      <Cell label="MEL Ref"><span className="mono">{e ? (e.kind === 'mel' ? `MEL ${e.mel_ref}` : e.manual_reference) : ''}</span></Cell>
                      <Cell label="Days allowed">{e ? (e.kind === 'mel' && e.interval_unit !== 'calendar_days' ? limitText(e) : (e.kind === 'mel' ? e.interval_value : e.days_allowed)) : ''}</Cell>
                      <Cell label="(M)">{e ? (e.m_required ? 'Req' : 'N/A') : ''}</Cell>
                      <Cell label="(O)">{e ? (e.o_required ? 'Req' : 'N/A') : ''}</Cell>
                      <Cell label="Name (3LC) · signature"><span className="mono">{e ? who(e.deferrer) : ''}</span></Cell>
                      <Cell label="Defer date"><span className="mono">{e ? d(e.deferred_at) : ''}</span></Cell>
                      <Cell label="Rectification due"><span className="mono">{e?.due_at ? d(e.due_at) : (e?.limit_text ?? '')}</span></Cell>
                    </tr>
                    <tr>
                      <Cell label="Pilot report or maintenance entry" colSpan={5}>{e?.defect_text}{e?.remarks && ` · ${e.remarks}`}</Cell>
                      <Cell label="Extension ref"><span className="mono">{ext?.authority_reference ?? ''}</span></Cell>
                      <Cell label="Extension due"><span className="mono">{ext ? (ext.new_due_at ? d(ext.new_due_at) : `+${ext.extra_days} d (waiting for approval)`) : ''}</span></Cell>
                      <Cell label="Name · signature" colSpan={2}><span className="mono">{ext ? who(ext.requester) : ''}</span></Cell>
                    </tr>
                    <tr>
                      <Cell label="Rectification actions" colSpan={5}>{e?.rectification ?? ''}</Cell>
                      <Cell label="Rect. date"><span className="mono">{e ? d(e.cleared_at) : ''}</span></Cell>
                      <Cell label="TLB Book / Page"><span className="mono">{e ? join(' / ', e.rect_tlb_book, e.rect_tlb_page) : ''}</span></Cell>
                      <Cell label="Name (3LC) · signature" colSpan={2}><span className="mono">{e ? who(e.clearer) : ''}</span></Cell>
                    </tr>
                  </tbody>
                </table>
              );
            })}
            <p className="pr-small">Signatures are the PIN signatures recorded in Nexus (D-094), shown by three-letter code.</p>
            <PrintFoot printedAt={printedAt} page={i + 1} pages={pages.length} note="When all entries are closed, return the completed page to CAMO." />
          </section>
        );
      })}
    </PrintFrame>
  );
}

// ----------------------------------------------------------------- NADDS
const ROWS_PER_SHEET = 8; // D-161

export function NaddsPrint() {
  const { display } = useAuth();
  const { id, aircraft, settings, printedAt } = usePrintBasics();
  const [rows, setRows] = useState<Nadd[] | null>(null);
  useEffect(() => {
    db.from('nadd').select(NADD_SELECT).eq('aircraft_id', id).in('status', ['open', 'rectified']).order('reported_at')
      .then(({ data }) => setRows((data ?? []) as unknown as Nadd[]));
  }, [id]);
  if (!rows || !aircraft) return <div className="print-page">Preparing…</div>;
  const sheets: (Nadd | null)[][] = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += ROWS_PER_SHEET) {
    const chunk: (Nadd | null)[] = rows.slice(i, i + ROWS_PER_SHEET);
    while (chunk.length < ROWS_PER_SHEET) chunk.push(null);
    sheets.push(chunk);
  }
  const d = (v: string | null) => formatDate(v, display);
  const logRef = (n: Nadd) => (n.tlb_book || n.tlb_page ? `TLB ${join('/', n.tlb_book, n.tlb_page, n.tlb_item)}` : n.number);

  return (
    <PrintFrame title={`NADDS ${aircraft.tail}`} back={{ to: `/nadds?aircraft=${id}`, label: 'NADD list' }}>
      {sheets.map((sheet, i) => (
        <section key={i} className="print-sheet pr-sheet">
          <PrintHead settings={settings} title="Non-Airworthiness Deferred Defects" short="NADDS" form={settings.naddsForm}>
            <div>Aircraft Reg: <strong className="mono">{aircraft.tail}</strong></div>
            <div>Sheet No.: <strong className="mono">{String(i + 1).padStart(4, '0')}</strong></div>
          </PrintHead>
          <Provisional aircraftId={id} actionNames={['defer_as_nadd', 'confirm_nadd', 'rectify_nadd']} />
          <table className="print-table nadds pr-nadds">
            <thead>
              <tr>
                <th>S/N</th><th>Date</th><th>Log Ref No or WO Ref</th><th>Name (3LC)</th><th>Defect / Discrepancy</th>
                <th>Action Taken</th><th>Date</th><th>Name (3LC)</th><th>Log Ref No</th>
              </tr>
            </thead>
            <tbody>
              {sheet.map((n, r) => (
                <tr key={n?.id ?? `blank-${r}`}>
                  <td className="mono">{n ? i * ROWS_PER_SHEET + r + 1 : ''}</td>
                  <td className="mono">{n ? d(n.reported_at) : ''}</td>
                  <td className="mono">{n ? logRef(n) : ''}</td>
                  <td className="mono">{n ? who(n.reporter) : ''}</td>
                  <td>{n ? `${n.description}${n.location ? ` (${n.location})` : ''}` : ''}</td>
                  <td>{n?.action_taken ?? ''}</td>
                  <td className="mono">{n?.rectified_at ? d(n.rectified_at) : ''}</td>
                  <td className="mono">{n ? who(n.rectifier) : ''}</td>
                  <td className="mono">{n && (n.rect_tlb_book || n.rect_tlb_page) ? `TLB ${join('/', n.rect_tlb_book, n.rect_tlb_page)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {settings.naddsRemarks.length > 0 && (
            <div className="print-remarks">
              <strong>Remarks</strong>
              <ol>{settings.naddsRemarks.map((r) => <li key={r}>{r}</li>)}</ol>
            </div>
          )}
          <PrintFoot printedAt={printedAt} page={i + 1} pages={sheets.length} />
        </section>
      ))}
    </PrintFrame>
  );
}
