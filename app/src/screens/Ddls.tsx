// Deferred Defects Log Sheet (D-163, D-164, workflows/ddls.md), laid out as
// the Claude Design wireframes WF-DD1 (sheet), WF-E1 (MEL deferral list),
// WF-E2 (deferral detail), WF-DD3 (clear) and WF-DD4 (extension request).
//
// One sheet per tail, page by page, like the paper DDLS. Every MEL deferral
// arrives here automatically; non-MEL airworthiness deferrals are placed here
// by the engineer. Each open entry shows its limit as written and, for
// calendar limits, the time left (simple subtraction of recorded times,
// D-054). When the limit passes it shows "Limit exceeded" in red; Nexus never
// grounds the aircraft (D-020, D-057).
//
// All on the one /ddls address (no extra routes), chosen by the web address:
//   ?aircraft=<id>                        the sheet (WF-DD1)
//   ?aircraft=<id>&view=mel               MEL deferrals only (WF-E1)
//   ?aircraft=<id>&entry=<id>             one entry in full (WF-E2)
//   ?aircraft=<id>&entry=<id>&do=clear    clear it: request a work order (WF-DD3, D-218)
//   ?aircraft=<id>&entry=<id>&do=extend   request an extension (WF-DD4 / WF-E3, D-056)
//
// Engineers can:
//   Clear an entry   → request a work order; certifying it clears the entry
//                       and closes the snag (D-218)
//   Request extension → a separate approval (D-056); never for categories the
//                       operator excludes (PAF: Cat A, D-163): the button
//                       does not exist for them.
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { useOutbox } from '../lib/offline/hooks';
import { useApproachingDays } from '../lib/settings';
import { WorkOrderForm } from './Disposition';
import { formatDate, formatDateTime } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { BackButton, Crumbs, PageHead, Section, TailHeader, TailTabs, type Crumb } from '../components/PageFrame';
import { useFleetBoard } from './FleetBoard';
import { WorkOrderChip } from './WorkOrders';

export type DdlsEntry = {
  id: string; page_no: number; entry_no: number; kind: string; status: string;
  mel_ref: string | null; mel_category: string | null; manual_reference: string | null; days_allowed: number | null;
  interval_value: number | null; interval_unit: string | null;
  defect_text: string; m_required: boolean; o_required: boolean; remarks: string | null;
  m_done: boolean; o_passed: boolean; placard_fitted: boolean;
  tlb_book: string | null; tlb_page: string | null; tlb_item: string | null;
  deferred_at: string; due_at: string | null; limit_text: string | null;
  cleared_at: string | null; rectification: string | null; rect_tlb_book: string | null; rect_tlb_page: string | null;
  snag_id: string;
  deferrer: { three_letter_code: string } | null;
  clearer: { three_letter_code: string } | null;
  snag: { number: string } | null;
  mel_revision: { revision: string } | null;
  extensions: {
    id: string; extra_days: number; status: string; authority_reference: string; new_due_at: string | null;
    reason: string; created_at: string; requester: { three_letter_code: string } | null;
  }[];
};

export const DDLS_SELECT = `id, page_no, entry_no, kind, status, mel_ref, mel_category, manual_reference, days_allowed,
  interval_value, interval_unit, m_done, o_passed, placard_fitted,
  defect_text, m_required, o_required, remarks, tlb_book, tlb_page, tlb_item, deferred_at, due_at, limit_text,
  cleared_at, rectification, rect_tlb_book, rect_tlb_page, snag_id,
  deferrer:deferred_by (three_letter_code), clearer:cleared_by (three_letter_code), snag:snag_id (number),
  mel_revision:mel_revision_id (revision),
  extensions:ddls_extension (id, extra_days, status, authority_reference, new_due_at, reason, created_at,
    requester:requested_by (three_letter_code))`;

const DAY = 86_400_000;

// Time left on a calendar limit, as a plain subtraction of recorded times.
export function timeLeft(due: string | null, now: Date): { text: string; tone: string } | null {
  if (!due) return null;
  const ms = new Date(due).getTime() - now.getTime();
  if (ms < 0) return { text: 'Limit exceeded', tone: 'red' };
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / 3_600_000);
  return { text: days > 0 ? `${days}d ${hours}h left` : `${hours}h left`, tone: 'plain' };
}

// The countdown chip, as on the wireframes: "Open · 8 days" (grey),
// "Approaching · 1 day" (amber, within the operator's margin, setting
// attention.approaching_days) or "Limit exceeded" (red). Recorded due time
// minus now; nothing projected (D-020, D-054).
export function countdown(due: string | null, now: Date, marginDays: number): { label: string; tone: string } | null {
  if (!due) return null;
  const ms = new Date(due).getTime() - now.getTime();
  if (ms <= 0) return { label: 'Limit exceeded', tone: 'red' };
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / 3_600_000);
  const left = days >= 2 ? `${days} days` : days === 1 ? `1 day ${hours} h` : `${hours} h`;
  return ms <= marginDays * DAY ? { label: `Approaching · ${left}`, tone: 'amber' } : { label: `Open · ${left}`, tone: 'grey' };
}

// The limit exactly as written at deferral.
export function limitText(e: DdlsEntry): string {
  if (e.kind !== 'mel') return `${e.days_allowed ?? '—'} days (manual reference)`;
  if (e.interval_unit === 'calendar_days') return `${e.interval_value} days`;
  return e.limit_text ?? 'As specified in the MEL';
}

export const tlbRef = (book: string | null, page: string | null, item?: string | null) =>
  [book, page, item].filter(Boolean).join(' / ');

export function useTailParam(aircraft: AircraftOption[]) {
  const [params, setParams] = useSearchParams();
  const id = params.get('aircraft') || aircraft[0]?.id || '';
  const set = (v: string) => {
    const next = new URLSearchParams();
    if (v) next.set('aircraft', v);
    const view = params.get('view');
    if (view) next.set('view', view);
    setParams(next, { replace: true });
  };
  return [id, set] as const;
}

// The common top of a per-tail deferral page: breadcrumb, back button and,
// on list pages, the tail header and the tail's section tabs (PageFrame).
export function TailTop({ aircraftId, tail, here, back, full = true }: {
  aircraftId: string; tail?: string; here: Crumb[]; back: { to: string; label: string }; full?: boolean;
}) {
  const { rows } = useFleetBoard();
  const row = rows.find((r) => r.aircraft_id === aircraftId);
  const name = row?.tail ?? tail ?? '…';
  return (
    <>
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: <span className="mono">{name}</span>, to: `/aircraft/${aircraftId}` }, ...here]} />
      <BackButton to={back.to} label={back.label} />
      {full && row && <TailHeader row={row} />}
      {full && <TailTabs aircraftId={aircraftId} />}
    </>
  );
}

// Things signed or sent on this tablet that the server has not yet accepted
// (D-217): shown as provisional on every screen that shows the record.
export function PendingBanner({ aircraftId, actionNames }: { aircraftId?: string; actionNames: string[] }) {
  const items = useOutbox().filter((i) => i.status !== 'sent' && actionNames.includes(i.action)
    && (!aircraftId || i.aircraftId === aircraftId));
  if (items.length === 0) return null;
  return (
    <div className="offline-banner" role="status">
      <strong>Waiting on this tablet, provisional:</strong>
      <ul style={{ margin: '4px 0 0' }}>
        {items.map((p) => (
          <li key={p.id}>{p.label}{p.kind === 'signed' && ' · Signed offline · awaiting server check'}
            {p.status === 'failed' && <> · <span style={{ color: 'var(--red)' }}>refused: {p.error}</span></>}</li>
        ))}
      </ul>
      <Link to="/sync">Send queue</Link>
    </div>
  );
}

export function Message({ text }: { text: string }) {
  if (!text) return null;
  return <div className={/provisional|queued/.test(text) ? 'offline-banner' : 'success'} role="status">{text}</div>;
}

// One labelled value, as the wireframes' four-across fact grid.
export function Fact({ k, children }: { k: ReactNode; children: ReactNode }) {
  return <div className="dd-fact"><div className="dd-k">{k}</div><div className="dd-v">{children}</div></div>;
}

const DDLS_ACTIONS = ['apply_mel', 'defer_on_ddls', 'clear_ddls_entry', 'certify_work_order'];

export function DdlsSheet() {
  const { me, display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [params, setParams] = useSearchParams();
  const [tailId, setTailId] = useTailParam(aircraft);
  const view = params.get('view') === 'mel' ? 'mel' : 'sheet';
  const entryId = params.get('entry');
  const doing = params.get('do');
  const [showCleared, setShowCleared] = useState(false);
  const [entries, setEntries] = useState<DdlsEntry[] | null>(null);
  const [extCats, setExtCats] = useState<string[]>(['B', 'C', 'D']);
  const [message, setMessage] = useState('');
  const margin = useApproachingDays();
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));
  const now = useMemo(() => new Date(), [entries]);
  const tail = aircraft.find((a) => a.id === tailId);

  const load = useCallback(async () => {
    if (!tailId) return;
    let q = db.from('ddls_entry').select(DDLS_SELECT).eq('aircraft_id', tailId).order('page_no').order('entry_no');
    if (!showCleared && !entryId) q = q.eq('status', 'open');
    const key = entryId ? `ddls:${tailId}:true` : `ddls:${tailId}:${showCleared}`;
    const { data } = await cached(key, () => q);
    setEntries((data ?? []) as unknown as DdlsEntry[]);
  }, [tailId, showCleared, entryId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    db.from('operator_setting_current').select('value').eq('key', 'ddls.extension_categories').maybeSingle()
      .then(({ data }) => { if (Array.isArray(data?.value)) setExtCats(data!.value as string[]); });
  }, []);

  // Moves between the sheet, one entry and its actions, keeping the tail.
  const go = (next: { view?: string; entry?: string; do?: string }) => {
    const p = new URLSearchParams();
    if (tailId) p.set('aircraft', tailId);
    if (next.view) p.set('view', next.view);
    if (next.entry) p.set('entry', next.entry);
    if (next.do) p.set('do', next.do);
    setParams(p);
    window.scrollTo(0, 0);
  };
  const entryLink = (e: DdlsEntry, action?: string) =>
    `/ddls?aircraft=${tailId}${view === 'mel' ? '&view=mel' : ''}&entry=${e.id}${action ? `&do=${action}` : ''}`;

  const canExtendWhy = (e: DdlsEntry): string | null => {
    if (e.status !== 'open') return 'This entry is cleared.';
    if (e.extensions.some((x) => x.status === 'pending')) return 'An extension is already waiting for approval.';
    if (!e.due_at) return 'Only calendar-day limits can be extended here.';
    if (e.kind === 'mel' && !extCats.includes(e.mel_category ?? '')) return `MEL category ${e.mel_category} items cannot be extended (D-163).`;
    return null;
  };

  if (!tailId) {
    return <div className="page"><p className="muted">No aircraft in your scope.</p></div>;
  }

  // ----- one entry: detail (WF-E2), clear (WF-DD3), extension (WF-DD4)
  if (entryId) {
    const e = entries?.find((x) => x.id === entryId);
    const listLabel = view === 'mel' ? 'MEL deferrals' : 'DDLS';
    const listTo = `/ddls?aircraft=${tailId}${view === 'mel' ? '&view=mel' : ''}`;
    const name = e ? (e.kind === 'mel' ? `MEL ${e.mel_ref}` : `DDLS entry ${e.page_no}/${e.entry_no}`) : 'Entry';
    const here: Crumb[] = [{ label: listLabel, to: listTo }];
    if (doing) here.push({ label: name, to: entryLink(e ?? ({ id: entryId } as DdlsEntry)) });
    here.push({ label: doing === 'clear' ? 'Clear DDLS entry' : doing === 'extend' ? 'Extension request' : name });
    const back = doing ? { to: entryLink(e ?? ({ id: entryId } as DdlsEntry)), label: 'Deferral detail' } : { to: listTo, label: listLabel };
    const done = (m: string) => { setMessage(m); go({ view: view === 'mel' ? 'mel' : undefined, entry: entryId }); load(); };
    const why = e ? canExtendWhy(e) : null;
    return (
      <div className="page dd-page">
        <TailTop aircraftId={tailId} tail={tail?.tail} here={here} back={back} full={false} />
        {!entries ? <p className="muted">Loading…</p> : !e ? <p>This entry is not on {tail?.tail ?? 'this tail'}'s DDLS.</p> : (
          <>
            <PageHead
              title={doing === 'clear' ? <>Clear DDLS entry {e.page_no}/{e.entry_no} · <span className="mono">{tail?.tail}</span></>
                : doing === 'extend' ? <>Extension request · {name} · <span className="mono">{tail?.tail}</span></>
                : <>{e.kind === 'mel' ? <span className="mono">MEL {e.mel_ref}</span> : name} · <span className="mono">{tail?.tail}</span></>}
              sub={doing === 'clear' ? 'Clearing needs an approved work order (D-218); certifying it clears this entry'
                : doing === 'extend' ? `Only for categories the operator allows (${extCats.join(', ')}) · separate approval (D-056)`
                : `Deferral detail · DDLS page ${e.page_no}, entry ${e.entry_no}`}>
              {!doing && isEngineer && e.status === 'open' && (
                <>
                  {!why && <Link className="button outline-button" to={entryLink(e, 'extend')}>Request extension</Link>}
                  <Link className="button" to={entryLink(e, 'clear')}>Clear entry</Link>
                </>
              )}
            </PageHead>
            <Message text={message} />
            <PendingBanner aircraftId={tailId} actionNames={DDLS_ACTIONS} />
            <EntrySummary e={e} now={now} margin={margin} compact={Boolean(doing)} />
            {doing === 'clear' && (
              isEngineer && e.status === 'open'
                ? <Section title="Clear this entry"><ClearForm entry={e} onDone={done} /></Section>
                : <p className="muted">{e.status === 'open' ? 'Only engineers can request the work order that clears an entry.' : 'This entry is already cleared.'}</p>
            )}
            {doing === 'extend' && (
              isEngineer && !why
                ? <Section title="Request an extension"><ExtendForm entry={e} onDone={done} onCancel={() => go({ view: view === 'mel' ? 'mel' : undefined, entry: e.id })} /></Section>
                : <p className="muted">{why ?? 'Only engineers can request an extension.'}</p>
            )}
            {!doing && (
              <>
                <Extensions e={e} />
                {e.status === 'cleared' ? (
                  <Section title="Clearing">
                    <div className="dd-grid">
                      <Fact k="Rectification">{e.rectification ?? '—'}</Fact>
                      <Fact k="Cleared">{formatDateTime(e.cleared_at, display)}</Fact>
                      <Fact k="TLB book / page">{tlbRef(e.rect_tlb_book, e.rect_tlb_page) || '—'}</Fact>
                      <Fact k="Cleared by"><span className="mono">{e.clearer?.three_letter_code ?? '—'}</span> (signed with PIN)</Fact>
                    </div>
                  </Section>
                ) : isEngineer && (
                  <Section title="Clearing">
                    <ClearForm entry={e} onDone={done} requestLink={entryLink(e, 'clear')} />
                  </Section>
                )}
                {isEngineer && e.status === 'open' && why && <p className="small muted">{why}</p>}
                <p className="small muted">
                  <Link to={`/snags/${e.snag_id}`}>Open {e.snag?.number ?? 'the snag'}</Link> · DDLS and NADD entries never change the aircraft status.
                </p>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // ----- the sheet (WF-DD1) or the MEL deferral list (WF-E1)
  const shown = (entries ?? []).filter((e) => view !== 'mel' || e.kind === 'mel');
  const pages = new Map<number, DdlsEntry[]>();
  shown.forEach((e) => pages.set(e.page_no, [...(pages.get(e.page_no) ?? []), e]));
  const lastPage = shown.length ? Math.max(...shown.map((e) => e.page_no)) : null;
  const melList = [...shown].sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9'));

  return (
    <div className="page dd-page">
      <TailTop aircraftId={tailId} tail={tail?.tail}
        here={[{ label: view === 'mel' ? 'MEL deferrals' : 'DDLS (deferred defects log sheet)' }]}
        back={{ to: `/aircraft/${tailId}`, label: `${tail?.tail ?? 'aircraft'} overview` }} />
      <PageHead
        title={view === 'mel' ? <>MEL deferrals · <span className="mono">{tail?.tail}</span></>
          : <>DDLS · <span className="mono">{tail?.tail}</span>{lastPage !== null && !showCleared && <> · page <span className="mono">{String(lastPage).padStart(2, '0')}</span></>}</>}
        sub={view === 'mel' ? 'MEL deferrals on this tail, soonest due first · they are also on the DDLS (D-163)'
          : 'Deferred defects that concern airworthiness · MEL deferrals appear here automatically'}>
        <div className="dd-toggle" role="group" aria-label="What to show">
          <button type="button" className={view === 'sheet' ? 'on' : ''} aria-pressed={view === 'sheet'} onClick={() => go({})}>Whole sheet</button>
          <button type="button" className={view === 'mel' ? 'on' : ''} aria-pressed={view === 'mel'} onClick={() => go({ view: 'mel' })}>MEL only</button>
        </div>
        <label className="check dd-inline-check">
          <input type="checkbox" checked={showCleared} onChange={(e) => setShowCleared(e.target.checked)} /> Show cleared
        </label>
        <Link className="button outline-button" to={`/print/ddls/${tailId}`} target="_blank">Print DDLS</Link>
        <AircraftPicker aircraft={aircraft} value={tailId} onChange={setTailId} placeholder="Choose a tail" />
      </PageHead>
      <Message text={message} />
      <PendingBanner aircraftId={tailId} actionNames={DDLS_ACTIONS} />
      {isEngineer && (
        <p className="small muted dd-note">
          To defer a defect (under the MEL or on the DDLS with a manual reference), open its snag and choose the deferral there.
        </p>
      )}
      {!entries && <p className="muted">Loading…</p>}
      {entries && shown.length === 0 && (
        <div className="box"><div className="box-body"><p className="muted">No {showCleared ? '' : 'open '}{view === 'mel' ? 'MEL deferrals' : 'DDLS entries'} on {tail?.tail ?? 'this tail'}.</p></div></div>
      )}

      {view === 'mel' && melList.length > 0 && (
        <div className="box">
          <div className="table-scroll">
            <table className="ptable">
              <thead><tr><th>Item</th><th>Cat</th><th>Remaining</th><th>MEL revision</th><th>Deferred by</th><th>DDLS</th></tr></thead>
              <tbody>
                {melList.map((e) => {
                  const c = e.status === 'open' ? countdown(e.due_at, now, margin) : null;
                  return (
                    <tr key={e.id}>
                      <td><Link className="mono" to={entryLink(e)}>MEL {e.mel_ref}</Link><div className="small">{e.defect_text}</div></td>
                      <td>{e.mel_category}</td>
                      <td>{e.status === 'cleared' ? <span className="chip tone-grey">Cleared</span>
                        : c ? <span className={`chip tone-${c.tone}`}>{c.label}</span> : <span className="small">{limitText(e)}</span>}</td>
                      <td className="mono">{e.mel_revision ? `Rev ${e.mel_revision.revision}` : '—'}</td>
                      <td><span className="mono">{e.deferrer?.three_letter_code}</span> · {formatDate(e.deferred_at, display)}</td>
                      <td className="mono">{e.page_no}/{e.entry_no}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'sheet' && [...pages.entries()].map(([page, list]) => {
        const closed = list.every((e) => e.status === 'cleared');
        return (
          <Section key={page} title={<>Page <span className="mono">{String(page).padStart(2, '0')}</span></>}
            actions={closed ? <span className="chip tone-grey">Page closed · return the completed page to CAMO</span> : undefined}>
            {list.map((e) => (
              <EntryCard key={e.id} e={e} now={now} margin={margin} to={entryLink(e)}
                actions={isEngineer && e.status === 'open' && (
                  <>
                    {!canExtendWhy(e) && <Link className="button outline-button" to={entryLink(e, 'extend')}>Request extension</Link>}
                    <Link className="button outline-button" to={entryLink(e, 'clear')}>Clear entry</Link>
                  </>
                )} />
            ))}
          </Section>
        );
      })}
      <p className="small muted">DDLS and NADD entries never change the aircraft status (D-057). Cat A items show their own limit and have no extension button.</p>
    </div>
  );
}

// One entry on the sheet, as the wireframe's entry box.
function EntryCard({ e, now, margin, to, actions }: { e: DdlsEntry; now: Date; margin: number; to: string; actions?: ReactNode }) {
  const { display } = useAuth();
  const c = e.status === 'open' ? countdown(e.due_at, now, margin) : null;
  const pending = e.extensions.find((x) => x.status === 'pending');
  return (
    <article className={`dd-entry${e.status === 'cleared' ? ' cleared' : ''}${c?.tone === 'red' ? ' over' : ''}`}>
      <div className="dd-entry-head">
        <Link to={to}>Entry {e.entry_no}</Link>
        <span className="mono">· TLB {tlbRef(e.tlb_book, e.tlb_page, e.tlb_item) || '—'}</span>
        <Link className="small" to={`/snags/${e.snag_id}`}>{e.snag?.number}</Link>
      </div>
      <div className="dd-grid">
        <Fact k="MEL cat / ref">{e.kind === 'mel'
          ? <>{e.mel_category} · <span className="mono">MEL {e.mel_ref}</span></>
          : <>Not MEL · <span className="mono">{e.manual_reference}</span></>}</Fact>
        <Fact k="Days allowed / limit">{limitText(e)}</Fact>
        <Fact k="Defer date"><span className="mono">{formatDate(e.deferred_at, display)}</span></Fact>
        <Fact k="Rectification due"><span className="mono">{e.due_at ? formatDateTime(e.due_at, display) : (e.limit_text ?? '—')}</span></Fact>
      </div>
      <div><strong>Defect:</strong> {e.defect_text}{e.remarks && <span className="muted"> · {e.remarks}</span>}</div>
      <div className="small">
        (M) {e.m_required ? 'required' : 'N/A'} · (O) {e.o_required ? 'required' : 'N/A'} · Deferred by{' '}
        <span className="mono">{e.deferrer?.three_letter_code}</span> (signed with PIN)
      </div>
      {e.status === 'cleared' && (
        <div className="small">Cleared by <span className="mono">{e.clearer?.three_letter_code}</span> · {formatDateTime(e.cleared_at, display)}
          {e.rectification && <> · {e.rectification}</>}{(e.rect_tlb_book || e.rect_tlb_page) && <> · TLB <span className="mono">{tlbRef(e.rect_tlb_book, e.rect_tlb_page)}</span></>}</div>
      )}
      <div className="action-row">
        {e.status === 'cleared' ? <span className="chip tone-grey">Cleared</span>
          : c ? <span className={`chip tone-${c.tone}`}>{c.label}</span> : <span className="chip tone-grey">Open · limit as written</span>}
        {pending && <span className="chip tone-blue">Extension +{pending.extra_days} d waiting for approval</span>}
        {actions}
      </div>
    </article>
  );
}

// The deferral facts (WF-E2). Compact on the clear and extension pages.
function EntrySummary({ e, now, margin, compact }: { e: DdlsEntry; now: Date; margin: number; compact: boolean }) {
  const { display } = useAuth();
  const c = e.status === 'open' ? countdown(e.due_at, now, margin) : null;
  return (
    <Section title={compact ? `Entry ${e.page_no}/${e.entry_no} · ${e.defect_text}` : 'Deferral'}
      actions={e.status === 'cleared' ? <span className="chip tone-grey">Cleared</span> : c ? <span className={`chip tone-${c.tone}`}>{c.label}</span> : undefined}>
      <div className="dd-grid">
        <Fact k={e.kind === 'mel' ? 'Category (from loaded MEL)' : 'Reference'}>{e.kind === 'mel'
          ? <>{e.mel_category} · <span className="mono">MEL {e.mel_ref}</span></>
          : <>Not MEL · <span className="mono">{e.manual_reference}</span></>}</Fact>
        <Fact k="Days allowed / limit">{limitText(e)}</Fact>
        <Fact k="Defer date"><span className="mono">{formatDateTime(e.deferred_at, display)}</span></Fact>
        <Fact k="Rectification due"><span className="mono">{e.due_at ? formatDateTime(e.due_at, display) : (e.limit_text ?? '—')}</span></Fact>
        {!compact && <>
          <Fact k="TLB book / page / item"><span className="mono">{tlbRef(e.tlb_book, e.tlb_page, e.tlb_item) || '—'}</span></Fact>
          {e.kind === 'mel' && <Fact k="MEL revision"><span className="mono">{e.mel_revision ? `Rev ${e.mel_revision.revision}` : '—'}</span></Fact>}
          <Fact k="Deferred by"><span className="mono">{e.deferrer?.three_letter_code}</span> (signed with PIN)</Fact>
          <Fact k="Snag"><Link className="mono" to={`/snags/${e.snag_id}`}>{e.snag?.number ?? 'Open'}</Link></Fact>
        </>}
      </div>
      {!compact && <div><strong>Defect:</strong> {e.defect_text}</div>}
      {!compact && e.remarks && <div><strong>Remarks:</strong> {e.remarks}</div>}
      {!compact && (
        <div className="dd-confirms">
          <span>{e.m_required ? (e.m_done ? '☑' : '☐') : '–'} (M) maintenance procedure {e.m_required ? 'done' : 'not required'}</span>
          <span>{e.o_required ? (e.o_passed ? '☑' : '☐') : '–'} (O) procedure {e.o_required ? 'passed to Operations' : 'not required'}</span>
          {e.kind === 'mel' && <span>{e.placard_fitted ? '☑' : '☐'} Placard fitted</span>}
        </div>
      )}
      {!compact && c && <p className="small muted" style={{ margin: 0 }}>Countdown is the recorded due time minus now (D-054). Nexus does not ground the aircraft; the certifying engineer decides (D-057).</p>}
    </Section>
  );
}

function Extensions({ e }: { e: DdlsEntry }) {
  const { display } = useAuth();
  if (e.extensions.length === 0) return null;
  const list = [...e.extensions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <Section title="Extensions">
      <div className="table-scroll">
        <table className="ptable">
          <thead><tr><th>#</th><th>Extra days</th><th>New due</th><th>Authority reference</th><th>Reason</th><th>Requested by</th><th>State</th></tr></thead>
          <tbody>
            {list.map((x, i) => (
              <tr key={x.id}>
                <td className="mono">{i + 1}</td>
                <td className="mono">+{x.extra_days} d</td>
                <td className="mono">{x.new_due_at ? formatDateTime(x.new_due_at, display) : '—'}</td>
                <td className="mono">{x.authority_reference}</td>
                <td>{x.reason}</td>
                <td><span className="mono">{x.requester?.three_letter_code ?? '—'}</span> · {formatDate(x.created_at, display)}</td>
                <td><span className={`chip tone-${x.status === 'approved' ? 'green' : x.status === 'pending' ? 'blue' : 'grey'}`}>
                  {x.status === 'pending' ? 'Waiting for approval' : x.status === 'approved' ? 'Approved' : x.status === 'rejected' ? 'Rejected' : x.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// Clearing an entry needs an approved work order (D-218): request one here;
// certifying it (certifying engineer, PIN) clears the entry and closes the
// snag in the same signature.
// With requestLink (the detail page) it only says where things stand and
// links to the clear page instead of showing the whole form.
function ClearForm({ entry, onDone, requestLink }: { entry: DdlsEntry; onDone: (m: string) => void; requestLink?: string }) {
  const [wos, setWos] = useState<{ id: string; number: string; status: string }[] | null>(null);
  useEffect(() => {
    cached(`snag:${entry.snag_id}:wo`, () => db.from('work_order').select('id, number, status').eq('snag_id', entry.snag_id))
      .then((r) => setWos((r.data ?? []) as { id: string; number: string; status: string }[]));
  }, [entry.snag_id]);
  const active = wos?.find((w) => ['requested', 'pre_approved', 'open', 'work_complete'].includes(w.status));
  if (!wos) return <p className="muted">Loading…</p>;
  if (active) {
    return (
      <>
        <div className="dd-wo">
          <span className="dd-k">Work order (required to clear, D-218)</span>
          <span><Link className="mono" to={`/work-orders/${active.id}`}>{active.number}</Link> <WorkOrderChip status={active.status} /></span>
        </div>
        <p style={{ margin: 0 }}>
          Certifying this work order (certifying engineer, PIN) records the rectification and its TLB reference, clears
          this entry and closes {entry.snag?.number ?? 'the snag'}.
        </p>
        <p className="action-row" style={{ margin: 0 }}><Link className="button" to={`/work-orders/${active.id}`}>Open {active.number}</Link></p>
        <p className="small muted" style={{ margin: 0 }}>When the last entry on a page is cleared the page shows "Page closed".</p>
      </>
    );
  }
  if (requestLink) {
    return (
      <>
        <p style={{ margin: 0 }}>No work order yet. Clearing needs an approved work order (D-218); certifying it clears this entry.</p>
        <p className="action-row" style={{ margin: 0 }}><Link className="button" to={requestLink}>Request work order</Link></p>
      </>
    );
  }
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>
        No work order yet. Clearing needs an approved work order (D-218): request it here; Quality, then the CO, approve it.
      </p>
      <WorkOrderForm snag={{ id: entry.snag_id }} deferred onDone={onDone} />
    </>
  );
}

function ExtendForm({ entry, onDone, onCancel }: { entry: DdlsEntry; onDone: (m: string) => void; onCancel: () => void }) {
  const { display, me } = useAuth();
  const [days, setDays] = useState('');
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    if (!/^[0-9]+$/.test(days) || Number(days) < 1) return setError('Enter the extra days (a whole number).');
    if (!ref.trim()) return setError('Give the authority reference for the extension.');
    if (!reason.trim()) return setError('Give the reason.');
    setBusy(true);
    const { error: err } = await actions.rpc('request_ddls_extension', {
      p_entry: entry.id, p_extra_days: Number(days), p_authority_reference: ref.trim(), p_reason: reason.trim(),
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone(`Extension of ${days} days requested for entry ${entry.page_no}/${entry.entry_no}. It goes to the approver; the limit is unchanged until approved (D-056).`);
  }
  // The requested due time: the recorded due plus the days asked for. The
  // server sets the real one only when the extension is approved.
  const asked = entry.due_at && days ? new Date(new Date(entry.due_at).getTime() + Number(days) * DAY) : null;
  return (
    <form onSubmit={submit}>
      <div className="row dd-form-row">
        <div><label htmlFor={`xr-${entry.id}`}>Extension reference <span className="hint">(authority reference)</span></label>
          <input id={`xr-${entry.id}`} className="mono" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        <div><label htmlFor={`xd-${entry.id}`}>Extra days</label>
          <input id={`xd-${entry.id}`} className="mono" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} /></div>
      </div>
      {asked && <p className="small">Extension due as requested: <span className="mono">{formatDateTime(asked, display)}</span> (recorded due {formatDateTime(entry.due_at, display)} plus {days} days).</p>}
      <label htmlFor={`xn-${entry.id}`}>Reason</label>
      <textarea id={`xn-${entry.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
      <p className="small muted">Requested by <span className="mono">{me?.tlc}</span>. No signature yet: the approver signs with their PIN.</p>
      {error && <div className="error" role="alert">{error}</div>}
      <p className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit for approval'}</button>
        <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
      </p>
    </form>
  );
}
