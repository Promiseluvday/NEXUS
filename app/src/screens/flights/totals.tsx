// Flight totals for the rest of the app (D-022): hours, cycles, landings,
// and who entered the last record. Everything comes from the database
// functions app.aircraft_totals(id) and app.fleet_totals(), which add up
// the newest version of each human-entered flight record (baseline +
// flights). The screen adds nothing and forecasts nothing (D-020, D-021).
//
// For the lead, to wire in:
//   useAircraftTotals(aircraftId)  → { totals, error, reload }   one tail
//   useFleetTotals()               → { byAircraft, error, reload } all tails in scope
//   <TotalsFacts totals={…} />     the three-figure grid + "last record entered by"
//   formatHours(n), formatCount(n) number display used everywhere
//
// Also registers log_flight with the offline send queue (see bottom).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { anyActions, errorText } from '../../lib/supabase';
import { cached } from '../../lib/offline/cache';
import { useAuth } from '../../lib/auth';
import { formatDateTime, formatPlainDate } from '../../lib/format';

export type AircraftTotals = {
  aircraft_id: string;
  tail: string;
  hours: number;
  cycles: number;
  landings: number;
  apu_hours: number | null;     // null until an APU figure has been entered
  apu_cycles: number | null;
  hours_basis: 'flight' | 'block';
  has_baseline: boolean;
  baseline_as_at: string | null;
  flights: number;
  last_flight_date: string | null;
  last_entered_by: string | null;   // 3LC
  last_entered_name: string | null;
  last_entered_at: string | null;
};

// Postgres numeric comes back as a string or a number: make it a number.
function clean(r: Record<string, unknown>): AircraftTotals {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...(r as unknown as AircraftTotals),
    hours: n(r.hours) ?? 0,
    cycles: n(r.cycles) ?? 0,
    landings: n(r.landings) ?? 0,
    apu_hours: n(r.apu_hours),
    apu_cycles: n(r.apu_cycles),
    flights: n(r.flights) ?? 0,
  };
}

// 18,950.0 (hours always one decimal place, as entered)
export function formatHours(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
// 6,204
export function formatCount(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

export const basisLabel = (b: string | null | undefined) => (b === 'block' ? 'Block hours' : 'Flight hours');

// One tail. Saved for offline use; offline it shows the last saved figures.
export function useAircraftTotals(aircraftId: string | undefined) {
  const [totals, setTotals] = useState<AircraftTotals | null>(null);
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const reload = useCallback(async () => {
    if (!aircraftId) return;
    const r = await cached(`flight-totals:${aircraftId}`, () => anyActions.rpc('aircraft_totals', { p_aircraft: aircraftId }));
    if (r.error) return setError(errorText(r.error));
    setError('');
    const rows = (r.data ?? []) as Record<string, unknown>[];
    setTotals(rows[0] ? clean(rows[0]) : null);
    setFromCache(r.fromCache);
  }, [aircraftId]);
  useEffect(() => { reload(); }, [reload]);
  return { totals, error, reload, fromCache };
}

// Every tail the user may see, keyed by aircraft id (fleet board cards).
export function useFleetTotals() {
  const [byAircraft, setByAircraft] = useState<Record<string, AircraftTotals>>({});
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    const r = await cached('fleet-totals', () => anyActions.rpc('fleet_totals'));
    if (r.error) return setError(errorText(r.error));
    setError('');
    const out: Record<string, AircraftTotals> = {};
    ((r.data ?? []) as Record<string, unknown>[]).forEach((row) => {
      const t = clean(row);
      out[t.aircraft_id] = t;
    });
    setByAircraft(out);
  }, []);
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 60_000);
    return () => clearInterval(timer);
  }, [reload]);
  return { byAircraft, error, reload };
}

// The Totals block of the aircraft page (Home.dc.html): three figures, then
// "Sum of entered flight records · last record entered by X · time".
// Uses the theme's facts-grid, so it drops straight into the Aircraft
// record panel in place of the "Soon" grid.
export function TotalsFacts({ totals, aircraftId, showLink = true }: {
  totals: AircraftTotals | null; aircraftId: string; showLink?: boolean;
}) {
  const { display } = useAuth();
  const none = !totals || (!totals.has_baseline && totals.flights === 0);
  return (
    <>
      <div className="facts-grid">
        <div><div className="k">Total hours <span className="small muted">({basisLabel(totals?.hours_basis).toLowerCase()})</span></div>
          <div className={`v mono${none ? ' none' : ''}`}>{none ? '—' : formatHours(totals!.hours)}</div></div>
        <div><div className="k">Cycles</div><div className={`v mono${none ? ' none' : ''}`}>{none ? '—' : formatCount(totals!.cycles)}</div></div>
        <div><div className="k">Landings</div><div className={`v mono${none ? ' none' : ''}`}>{none ? '—' : formatCount(totals!.landings)}</div></div>
      </div>
      <p className="panel-note">
        Sum of entered flight records
        {totals?.has_baseline && <> · brought forward as at {formatPlainDate(totals.baseline_as_at, display)}</>}
        {totals?.last_entered_by
          ? <> · last record entered by <span className="mono">{totals.last_entered_by}</span> · <span className="mono">{formatDateTime(totals.last_entered_at, display)}</span></>
          : <> · nothing entered yet</>}
        {showLink && <> · <Link to={`/flights?aircraft=${aircraftId}`}>Flight records</Link></>}
      </p>
    </>
  );
}

// Offline (D-102, D-103): a logged flight waits in the send queue like a snag
// report (log_flight is 'queue' in lib/perform.ts OFFLINE_MODE); its one-off
// reference (client_ref) stops a re-send creating a duplicate.
