// Printable DDLS and NADDS (D-049, D-097, D-161, workflows/ddls.md, nadd.md).
//
// Opened in a new tab without the app frame, laid out for A4 landscape; the
// browser's Print button (or "Save as PDF") produces the sheet. Every page
// carries "Printed from Nexus MRO · time · by whom · uncontrolled when
// printed": the electronic record is the master (D-023).
//
// The layout is Liebetag's first template, built from the field lists in the
// workflow write-ups, not from any operator's real form (D-112, D-113). The
// operator's name, form numbers and NADDS foot remarks are settings (D-025).
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import { formatDate, formatDateTime } from '../lib/format';
import { DDLS_SELECT, type DdlsEntry } from './Ddls';
import { NADD_SELECT, type Nadd } from './Nadds';

type Settings = { operator: string; ddlsForm: string; naddsForm: string; naddsRemarks: string[] };

function usePrintBasics() {
  const { id } = useParams();
  const [aircraft, setAircraft] = useState<{ tail: string; aircraft_type_code: string } | null>(null);
  const [settings, setSettings] = useState<Settings>({ operator: '', ddlsForm: '', naddsForm: '', naddsRemarks: [] });
  const printedAt = useState(() => new Date())[0];
  useEffect(() => {
    db.from('aircraft').select('tail, aircraft_type_code').eq('id', id!).maybeSingle().then(({ data }) => setAircraft(data));
    db.from('operator_setting_current').select('key, value')
      .in('key', ['operator.name', 'print.ddls_form_number', 'print.nadds_form_number', 'print.nadds_remarks'])
      .then(({ data }) => {
        const get = (k: string) => data?.find((r) => r.key === k)?.value;
        setSettings({
          operator: (get('operator.name') as string) ?? '',
          ddlsForm: (get('print.ddls_form_number') as string) ?? '',
          naddsForm: (get('print.nadds_form_number') as string) ?? '',
          naddsRemarks: (get('print.nadds_remarks') as string[]) ?? [],
        });
      });
  }, [id]);
  return { id: id!, aircraft, settings, printedAt };
}

function PrintFrame({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => { document.title = title; }, [title]);
  return (
    <div className="print-page">
      <div className="print-tools no-print">
        <button type="button" onClick={() => window.print()}>Print or save as PDF</button>
        <span className="small muted">Set the paper to A4, landscape.</span>
      </div>
      {children}
    </div>
  );
}

function PrintFoot({ printedAt, page, pages }: { printedAt: Date; page: number; pages: number }) {
  const { me, display } = useAuth();
  return (
    <div className="print-foot">
      Printed from Nexus MRO · {formatDateTime(printedAt, display)} · by {me?.fullName} ({me?.tlc}) · sheet {page} of {pages} ·
      uncontrolled when printed: the electronic record is the master
    </div>
  );
}

const who = (p: { three_letter_code: string } | null) => p?.three_letter_code ?? '';

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

  return (
    <PrintFrame title={`DDLS ${aircraft.tail}`}>
      {pages.length === 0 && <p>No DDLS entries on {aircraft.tail}.</p>}
      {pages.map((page, i) => {
        const list = entries.filter((e) => e.page_no === page);
        return (
          <section key={page} className="print-sheet">
            <header className="print-head">
              <div><strong>{settings.operator}</strong>{settings.ddlsForm && <div className="small">{settings.ddlsForm}</div>}</div>
              <h1>Deferred Defects Log Sheet</h1>
              <div className="print-ids">
                <div>Aircraft type: <strong>{aircraft.aircraft_type_code}</strong></div>
                <div>Registration: <strong className="mono">{aircraft.tail}</strong></div>
                <div>DDLS page: <strong className="mono">{page}</strong>{list.every((e) => e.status === 'cleared') && ' · page closed'}</div>
              </div>
            </header>
            <table className="print-table">
              <thead>
                <tr>
                  <th rowSpan={2}>No</th><th rowSpan={2}>TLB book / page / item</th><th rowSpan={2}>MEL cat</th>
                  <th rowSpan={2}>MEL ref / manual ref</th><th rowSpan={2}>Days allowed / limit</th>
                  <th rowSpan={2}>Pilot report or maintenance entry</th><th rowSpan={2}>(M)</th><th rowSpan={2}>(O)</th>
                  <th colSpan={3}>Deferral</th><th colSpan={3}>Extension</th><th colSpan={4}>Clearing</th>
                </tr>
                <tr>
                  <th>Name</th><th>Date</th><th>Due</th>
                  <th>Ref</th><th>New due</th><th>Status</th>
                  <th>Rectification</th><th>Date</th><th>TLB book / page</th><th>Name</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const ext = e.extensions[e.extensions.length - 1];
                  return (
                    <tr key={e.id}>
                      <td className="mono">{e.entry_no}</td>
                      <td className="mono">{[e.tlb_book, e.tlb_page, e.tlb_item].filter(Boolean).join(' / ')}</td>
                      <td>{e.mel_category ?? ''}</td>
                      <td className="mono">{e.kind === 'mel' ? e.mel_ref : e.manual_reference}</td>
                      <td>{e.kind === 'mel'
                        ? (e.interval_unit === 'calendar_days' ? `${e.interval_value} days` : (e.limit_text ?? ''))
                        : `${e.days_allowed} days`}</td>
                      <td>{e.defect_text}</td>
                      <td>{e.m_required ? 'M' : 'N/A'}</td>
                      <td>{e.o_required ? 'O' : 'N/A'}</td>
                      <td className="mono">{who(e.deferrer)}</td>
                      <td>{d(e.deferred_at)}</td>
                      <td>{e.due_at ? formatDateTime(e.due_at, display) : ''}</td>
                      <td className="mono">{ext?.authority_reference ?? ''}</td>
                      <td>{ext?.new_due_at ? d(ext.new_due_at) : ext ? `+${ext.extra_days} d` : ''}</td>
                      <td>{ext?.status ?? ''}</td>
                      <td>{e.rectification ?? ''}</td>
                      <td>{d(e.cleared_at)}</td>
                      <td className="mono">{[e.rect_tlb_book, e.rect_tlb_page].filter(Boolean).join(' / ')}</td>
                      <td className="mono">{who(e.clearer)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="small">Signatures are the PIN signatures recorded in Nexus (D-094), shown by three-letter code.</p>
            <PrintFoot printedAt={printedAt} page={i + 1} pages={pages.length} />
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
  const logRef = (n: Nadd) => [n.tlb_book, n.tlb_page, n.tlb_item].filter(Boolean).join('/') || n.number;

  return (
    <PrintFrame title={`NADDS ${aircraft.tail}`}>
      {sheets.map((sheet, i) => (
        <section key={i} className="print-sheet">
          <header className="print-head">
            <div><strong>{settings.operator}</strong>{settings.naddsForm && <div className="small">{settings.naddsForm}</div>}</div>
            <h1>Non-Airworthiness Deferred Defects</h1>
            <div className="print-ids">
              <div>Aircraft reg: <strong className="mono">{aircraft.tail}</strong></div>
              <div>Sheet no: <strong className="mono">{i + 1}</strong></div>
            </div>
          </header>
          <table className="print-table nadds">
            <thead>
              <tr>
                <th>S/N</th><th>Date</th><th>Log ref no or WO ref</th><th>Name</th><th>Defect / discrepancy</th>
                <th>Action taken</th><th>Date</th><th>Name</th><th>Log ref no</th>
              </tr>
            </thead>
            <tbody>
              {sheet.map((n, r) => (
                <tr key={n?.id ?? `blank-${r}`}>
                  <td className="mono">{i * ROWS_PER_SHEET + r + 1}</td>
                  <td>{n ? d(n.reported_at) : ''}</td>
                  <td className="mono">{n ? logRef(n) : ''}</td>
                  <td className="mono">{n ? who(n.reporter) : ''}</td>
                  <td>{n ? `${n.description}${n.location ? ` (${n.location})` : ''}` : ''}</td>
                  <td>{n?.action_taken ?? ''}</td>
                  <td>{n?.rectified_at ? d(n.rectified_at) : ''}</td>
                  <td className="mono">{n ? who(n.rectifier) : ''}</td>
                  <td className="mono">{n ? [n.rect_tlb_book, n.rect_tlb_page].filter(Boolean).join('/') : ''}</td>
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
