// Small pieces shared by the ADs and SBs screens and the aircraft page panel
// (D-016, D-021, D-028). Colours only carry meaning (D-090 to D-094):
//   amber  Approaching / Awaiting verification
//   red    Reached / Rejected by Quality
//   green  Verified / Complied
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatDate, formatPlainDate } from '../../lib/format';
import {
  FLAG_LABEL, FLAG_TONE, STATUS_LABEL, STATUS_TONE, VERIFY_LABEL, VERIFY_TONE, figures, useAdSbSummary,
  type AdSbEntry, type Flag, type Status,
} from './data';
import '../../styles/p2-adsb.css';

export function AdSbStatusChip({ status }: { status: Status }) {
  return <span className={`chip tone-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function VerifyChip({ state }: { state: AdSbEntry['verification_state'] }) {
  return <span className={`chip tone-${VERIFY_TONE[state]}`}>{VERIFY_LABEL[state]}</span>;
}

export function FlagChip({ flag }: { flag: Flag }) {
  if (!flag) return null;
  return <span className={`chip tone-${FLAG_TONE[flag]}`}>{FLAG_LABEL[flag]}</span>;
}

// Next due exactly as the engineer entered it: date, hours / cycles, words.
// A figure in hours or cycles with no totals to compare says so plainly.
export function NextDue({ r, showFlag = true }: { r: AdSbEntry; showFlag?: boolean }) {
  const { display } = useAuth();
  const figs = figures(r.next_due_hours, r.next_due_cycles);
  const nothing = !r.next_due_on && !figs && !r.next_due_text;
  if (nothing) return <span className="muted">—</span>;
  const figureOnly = Boolean(figs) && !r.totals_available && (r.status === 'open' || r.status === 'recurring');
  return (
    <span className="adsb-due">
      {r.next_due_on && <span className="mono">{formatPlainDate(r.next_due_on, display)}</span>}
      {figs && <span className="mono">{figs}</span>}
      {r.next_due_text && <span className="small">{r.next_due_text}</span>}
      {showFlag && <FlagChip flag={r.due_flag} />}
      {figureOnly && <span className="small muted" title="Hours and cycles are compared only once flight-record totals exist.">entered figure · no totals to compare</span>}
    </span>
  );
}

export function LastComplied({ r }: { r: Pick<AdSbEntry, 'last_complied_on' | 'last_complied_hours' | 'last_complied_cycles'> }) {
  const { display } = useAuth();
  const figs = figures(r.last_complied_hours, r.last_complied_cycles);
  if (!r.last_complied_on && !figs) return <span className="muted">—</span>;
  return (
    <span className="adsb-due">
      {r.last_complied_on && <span className="mono">{formatPlainDate(r.last_complied_on, display)}</span>}
      {figs && <span className="mono">{figs}</span>}
    </span>
  );
}

// The Quality column: state, and who countersigned or rejected.
export function VerifyCell({ r }: { r: AdSbEntry }) {
  const { display } = useAuth();
  return (
    <span className="adsb-due">
      <VerifyChip state={r.verification_state} />
      {r.verified_by_tlc && <span className="small"><span className="mono">{r.verified_by_tlc}</span> · {formatDate(r.verified_at, display)}</span>}
    </span>
  );
}

// The "ADs and SBs" panel on the one-aircraft page (Home.dc.html):
// Reference · Status · Compliance method · Last complied · Next due (entered).
//   <AdSbPanelBody aircraftId={id} />
export function AdSbPanelBody({ aircraftId, limit = 6 }: { aircraftId: string; limit?: number }) {
  const { display } = useAuth();
  const s = useAdSbSummary(aircraftId);
  // Flagged first, then awaiting verification, then the rest by reference.
  const order = (r: AdSbEntry) => (r.due_flag === 'reached' ? 0 : r.due_flag === 'approaching' ? 1 : r.verification_state !== 'verified' ? 2 : 3);
  const rows = [...s.rows].sort((a, b) => order(a) - order(b) || a.reference.localeCompare(b.reference)).slice(0, limit);
  return (
    <>
      <div className="table-scroll">
        <table className="ptable">
          <thead><tr><th>Reference</th><th>Status</th><th>Compliance method</th><th>Last complied</th><th>Next due (entered)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.entry_key}>
                <td><Link className="mono" to={`/ads-sbs?aircraft=${aircraftId}&entry=${r.entry_key}`}>{r.doc_type} {r.reference}</Link></td>
                <td><AdSbStatusChip status={r.status} /></td>
                <td>{r.compliance_method ?? (r.status === 'not_applicable' ? <span className="muted">Not applicable</span> : '—')}</td>
                <td><LastComplied r={r} /></td>
                <td>
                  <NextDue r={r} />
                  <div className="small muted">
                    Entered by <span className="mono">{r.entered_by_tlc}</span> · {formatDate(r.entered_at, display)}
                    {r.verification_state !== 'verified' && <> · <VerifyChip state={r.verification_state} /></>}
                  </div>
                </td>
              </tr>
            ))}
            {!s.loading && s.rows.length === 0 && <tr><td colSpan={5} className="muted">No AD or SB entries on this tail yet.</td></tr>}
            {s.loading && <tr><td colSpan={5} className="muted">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
      {s.rows.length > rows.length && (
        <p className="small"><Link to={`/ads-sbs?aircraft=${aircraftId}`}>All {s.rows.length} entries</Link></p>
      )}
      <p className="panel-note">
        Every AD and SB entry, including applicability and next due, is made by an engineer and verified by Quality.
        Nothing is imported or calculated.
      </p>
    </>
  );
}
