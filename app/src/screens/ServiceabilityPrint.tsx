// Daily Aircraft Serviceability State print (D-203, extends D-097; layout
// WF-PRS Engineering copy and WF-PRS2 Operations copy).
//
//   /print/serviceability            Engineering copy
//   /print/serviceability?copy=ops   Operations copy (less engineering detail)
//
// Opened without the app frame, laid out for one A4 landscape sheet. Every
// tail in your aircraft scope (the database decides, D-121) with the status
// an ENGINEER set and who set it when (D-046), what is holding it ("Blocked
// by"), open snag / DDLS / NADD counts and the expected return to service the
// engineer entered. Nexus calculates nothing here (D-020): the counts at the
// top only count rows by their recorded status, and "days left" is the due
// time written at deferral minus now.
//
// "As at": fleet_board() only knows the state NOW, so the sheet is always as
// at the moment it was loaded, and says so. A past "as at" time needs a
// history read of tail status and the other records (marked "Soon").
//
// The operator's name and an optional classification marking are settings
// (D-025): operator.name, print.classification_marking.
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import { formatDateTime, formatPlainDate, heldFor } from '../lib/format';
import { TAIL_STATUS } from '../components/StatusChip';
import { dueText } from '../components/NeedsAttention';
import { useFleetBoard, type FleetRow } from './FleetBoard';

type OpenDdls = {
  id: string; aircraft_id: string; kind: string; mel_ref: string | null; mel_category: string | null;
  due_at: string | null; limit_text: string | null; o_required: boolean; placard_fitted: boolean;
};

type Settings = { operator: string; marking: string };

function useSheetData() {
  const [ddls, setDdls] = useState<OpenDdls[]>([]);
  const [settings, setSettings] = useState<Settings>({ operator: '', marking: '' });
  const load = useCallback(() => {
    db.from('ddls_entry')
      .select('id, aircraft_id, kind, mel_ref, mel_category, due_at, limit_text, o_required, placard_fitted')
      .eq('status', 'open').order('due_at')
      .then(({ data }) => setDdls((data ?? []) as unknown as OpenDdls[]));
    db.from('operator_setting_current').select('key, value')
      .in('key', ['operator.name', 'print.classification_marking'])
      .then(({ data }) => {
        const get = (k: string) => data?.find((r) => r.key === k)?.value;
        setSettings({
          operator: (get('operator.name') as string) ?? '',
          marking: (get('print.classification_marking') as string) ?? '',
        });
      });
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ddls, settings, reload: load };
}

// The words for a row's status. A pilot's snag waiting for an engineer is
// shown as such (D-200); the last engineer-set status stays beside it.
function statusWord(r: FleetRow): string {
  if (r.snag_display === 'snag_open') return 'Snag open';
  if (r.snag_display === 'snag_attended') return 'Snag attended';
  return r.status ? TAIL_STATUS[r.status]?.short ?? r.status : 'No status recorded';
}

// Operations copy: "Available for tasking" is the engineer's status said in
// Operations words, one fixed wording per status as drawn in WF-PRS2. It is
// NOT a judgement by Nexus (D-020, D-046).
function tasking(r: FleetRow): string {
  if (r.snag_display) return 'Not until Engineering assesses the snag (D-045)';
  switch (r.status) {
    case 'SVC': return 'Yes';
    case 'SVC_MEL': return 'Yes, with restrictions';
    case 'IN_CHECK': return 'No · in check';
    case 'US': case 'AOG': return 'No';
    default: return 'No status set by Engineering';
  }
}

export function ServiceabilityPrint() {
  const { me, display } = useAuth();
  const [params, setParams] = useSearchParams();
  const ops = params.get('copy') === 'ops';
  const { rows, error, loadedAt, load, fromCache } = useFleetBoard();
  const { ddls, settings, reload } = useSheetData();
  const asAt = loadedAt ?? new Date();
  useEffect(() => { document.title = `Serviceability state · ${ops ? 'Operations' : 'Engineering'} copy`; }, [ops]);

  const rowsSorted = [...rows].sort((a, b) => a.tail.localeCompare(b.tail));
  const count = (f: (r: FleetRow) => boolean) => rowsSorted.filter(f).length;
  const noSnag = (r: FleetRow) => !r.snag_display;
  const totals = [
    { k: 'Fleet', n: rowsSorted.length },
    { k: 'Serviceable', n: count((r) => noSnag(r) && r.status === 'SVC') },
    { k: 'Serviceable with MEL', n: count((r) => noSnag(r) && r.status === 'SVC_MEL') },
    { k: 'Snag open or attended (pilot report)', n: count((r) => !noSnag(r)) },
    { k: 'In check', n: count((r) => noSnag(r) && r.status === 'IN_CHECK') },
    { k: 'AOG / U/S', n: count((r) => noSnag(r) && (r.status === 'AOG' || r.status === 'US')) },
  ];
  const unset = count((r) => noSnag(r) && !r.status);
  if (unset) totals.push({ k: 'No status recorded', n: unset });

  const melFor = (id: string) => ddls.filter((e) => e.aircraft_id === id && e.kind === 'mel');
  const setBy = (r: FleetRow) => r.status_set_by
    ? <><span className="mono">{r.status_set_by}</span> · {formatDateTime(r.status_set_at, display)}</>
    : '—';
  const rts = (r: FleetRow) => r.expected_rts_on
    ? <>{formatPlainDate(r.expected_rts_on, display)} <span className="prs-soft">(entered by Engineering)</span></>
    : (r.snag_display || r.status === 'US' || r.status === 'AOG' || r.status === 'IN_CHECK' ? 'Not yet entered' : '—');
  const statusCell = (r: FleetRow) => <strong>{statusWord(r)}</strong>;
  const setByCell = (r: FleetRow) => r.snag_display
    ? <>Pilot report waiting{r.status && <><br /><span className="prs-soft">Last status {TAIL_STATUS[r.status]?.short ?? r.status} · {setBy(r)}</span></>}</>
    : setBy(r);

  return (
    <div className="print-page prs-page">
      <div className="print-tools no-print prs-tools">
        <Link to="/" className="button outline-button">← Back to All aircraft</Link>
        <span className="prs-copy" role="group" aria-label="Which copy">
          Copy:
          <button type="button" className="fchip" aria-pressed={!ops} onClick={() => setParams({})}>Engineering</button>
          <button type="button" className="fchip" aria-pressed={ops} onClick={() => setParams({ copy: 'ops' })}>Operations</button>
        </span>
        <span className="prs-asat">
          As at <strong className="mono">{formatDateTime(asAt, display)}</strong>
          <button type="button" className="outline-button" onClick={() => { load(); reload(); }}>Refresh to now</button>
          <span className="small muted">Earlier time <span className="rail-tag">Soon</span></span>
        </span>
        <button type="button" onClick={() => window.print()}>Print or save as PDF</button>
        <span className="small muted">Preview · this bar does not print · set the paper to A4, landscape</span>
      </div>
      {error && <div className="error no-print" role="alert">{error}</div>}
      {fromCache && <div className="offline-banner no-print" role="status">Offline · the sheet shows the board saved at {formatDateTime(asAt, display)}.</div>}

      <section className="print-sheet prs-sheet">
        <header className="print-head prs-head">
          <div className="prs-crest">{settings.operator || 'Operator'}</div>
          <div>
            <h1>Daily Aircraft Serviceability State</h1>
            <div className="prs-sub">{ops ? 'Operations' : 'Engineering'} copy · from the statuses set by Engineering in Nexus</div>
          </div>
          <div className="print-ids">
            <div>Unit: <strong>{settings.operator || '—'}</strong></div>
            <div>As at: <strong className="mono">{formatDateTime(asAt, display)}</strong> ({display.timeZone})</div>
            <div>Page: <strong>1 of 1</strong></div>
          </div>
        </header>

        <div className="prs-totals">
          {totals.map((t) => <span key={t.k}>{t.k}: <strong className="mono">{t.n}</strong></span>)}
        </div>

        {!loadedAt ? <p>Preparing…</p> : ops ? (
          <table className="print-table prs-table">
            <thead>
              <tr>
                <th>Tail</th><th>Status</th><th>Set by Engineering (3LC) · time</th><th>Available for tasking</th>
                <th>Operational restrictions ((O) procedures, placards)</th><th>Expected return to service</th><th>Hours · cycles · landings</th>
              </tr>
            </thead>
            <tbody>
              {rowsSorted.map((r) => {
                const oItems = melFor(r.aircraft_id).filter((e) => e.o_required);
                return (
                  <tr key={r.aircraft_id}>
                    <td><strong className="mono">{r.tail}</strong><br /><span className="prs-soft">{r.aircraft_type}</span></td>
                    <td>{statusCell(r)}</td>
                    <td>{setByCell(r)}</td>
                    <td><strong>{tasking(r)}</strong></td>
                    <td>{oItems.length === 0 ? '—' : oItems.map((e) => (
                      <div key={e.id}>(O) MEL <span className="mono">{e.mel_ref}</span>{e.placard_fitted && ' · placard fitted'}</div>
                    ))}</td>
                    <td>{rts(r)}</td>
                    <td className="prs-soft" title="Flight records arrive in a later phase">—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="print-table prs-table">
            <thead>
              <tr>
                <th>Tail</th><th>Status</th><th>Set by (3LC) · time</th><th>Reason / Blocked by</th><th>Open MEL</th>
                <th>DDLS / NADD</th><th>Open snags</th><th>Expected return to service</th><th>Hours · cycles</th>
              </tr>
            </thead>
            <tbody>
              {rowsSorted.map((r) => {
                const mel = melFor(r.aircraft_id);
                return (
                  <tr key={r.aircraft_id}>
                    <td><strong className="mono">{r.tail}</strong><br /><span className="prs-soft">{r.aircraft_type}</span></td>
                    <td>{statusCell(r)}</td>
                    <td>{setByCell(r)}</td>
                    <td>{r.blocked_by
                      ? <>{r.blocked_by} {r.blocked_ref && <span className="mono">{r.blocked_ref}</span>}
                          {(r.blocked_holder || r.blocked_since) && <><br /><span className="prs-soft">
                            {r.blocked_holder}{r.blocked_holder && r.blocked_since && ' · '}{r.blocked_since && `holding ${heldFor(r.blocked_since, asAt)}`}
                          </span></>}</>
                      : '—'}</td>
                    <td>{mel.length === 0 ? '—' : mel.map((e) => (
                      <div key={e.id}>
                        <span className="mono">{e.mel_ref}</span>{e.mel_category && ` · Cat ${e.mel_category}`}
                        {e.due_at ? ` · ${dueText(e.due_at, asAt)}` : e.limit_text ? ` · ${e.limit_text}` : ''}
                      </div>
                    ))}</td>
                    <td className="mono">{r.open_ddls} / {r.open_nadds}</td>
                    <td className="mono">{r.open_snags}</td>
                    <td>{rts(r)}</td>
                    <td className="prs-soft" title="Flight records arrive in a later phase">—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {loadedAt && rowsSorted.length === 0 && <p>No aircraft in your aircraft scope.</p>}

        <p className="prs-note">
          Statuses are as set by Engineering at the time above; changes after that time are not shown. Expected return to
          service dates are as entered by Engineering, never calculated. Hours and cycles arrive with flight records.
          {ops && ' The Operations copy leaves out part numbers, snag technical detail and MEL (M) procedures (D-120).'}
          {' '}Uncontrolled when printed: the electronic record is the master.
        </p>
        <div className="prs-signs">
          <div>Prepared by ({ops ? '3LC' : 'duty engineer, 3LC'}) · signature</div>
          <div>{ops ? 'Received by Operations (3LC) · signature · time' : 'Checked by (3LC) · signature'}</div>
        </div>
        {settings.marking && <div className="prs-marking">{settings.marking}</div>}
        <div className="print-foot">
          Printed from Nexus MRO · {formatDateTime(new Date(), display)} · by {me?.fullName} ({me?.tlc}) · sheet 1 of 1 ·
          uncontrolled when printed: the electronic record is the master
        </div>
      </section>
    </div>
  );
}
