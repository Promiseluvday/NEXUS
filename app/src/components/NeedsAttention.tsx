// "Needs attention" panel on the All aircraft dashboard (Main.dc.html).
//
// A short list of things someone must act on, most urgent first, each with
// a level chip, a reference, one line of text and the department that owns
// it. Everything comes from records already in the database:
//   AOG / U/S   tails an engineer set to AOG or Unserviceable
//   Due         DDLS deferrals and NADDs whose recorded due time is within
//               3 days (or past); the due time was written at deferral
//   Open        snags reported and not yet attended
//   Approval    approvals waiting for you
//   Expiry      certifying authorizations ending within 30 days
// Nothing here is worked out by Nexus: "due in 1 day" is the recorded due
// time minus now (D-020, D-021). The database only returns what this user
// may see (D-120). Stores shelf-life alerts join in Phase 2.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { db } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { formatPlainDate, heldFor, type DisplaySettings } from '../lib/format';
import type { FleetRow } from '../screens/FleetBoard';

type Level = 'aog' | 'us' | 'due' | 'open' | 'approval' | 'expiry';
const LEVEL_TEXT: Record<Level, string> = {
  aog: 'AOG', us: 'U/S', due: 'Due', open: 'Open', approval: 'Approval', expiry: 'Expiry',
};
const ORDER: Level[] = ['aog', 'us', 'due', 'open', 'approval', 'expiry'];

type Alert = { level: Level; ref: string; text: string; owner: string; to: string; sort: number };

type DdlsDue = {
  id: string; aircraft_id: string; kind: string; mel_category: string | null; due_at: string;
  aircraft: { tail: string } | null;
};
type AuthDue = { id: string; aircraft_type_code: string; expires_on: string };

const DAY = 86_400_000;

// "in 1 day", "in 5h 10m", "overdue by 2h 3m" (recorded time minus now).
export function dueText(due: string, now: Date): string {
  const ms = new Date(due).getTime() - now.getTime();
  if (ms < 0) return `overdue by ${heldFor(due, now)}`;
  const days = Math.floor(ms / DAY);
  if (days >= 1) return `in ${days} day${days > 1 ? 's' : ''}`;
  return `in ${heldFor(now.toISOString(), new Date(due))}`;
}

export function NeedsAttention({ rows, now, approvals, display }: {
  rows: FleetRow[]; now: Date; approvals: number; display: DisplaySettings;
}) {
  const [ddls, setDdls] = useState<DdlsDue[]>([]);
  const [auths, setAuths] = useState<AuthDue[]>([]);

  useEffect(() => {
    const soon = new Date(Date.now() + 3 * DAY).toISOString();
    cached('attention_ddls', () => db.from('ddls_entry')
      .select('id, aircraft_id, kind, mel_category, due_at, aircraft:aircraft_id (tail)')
      .eq('status', 'open').not('due_at', 'is', null).lte('due_at', soon).order('due_at'))
      .then((r) => setDdls((r.data ?? []) as unknown as DdlsDue[]));
    const month = new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10);
    cached('attention_auth', () => db.from('certifying_authorization')
      .select('id, aircraft_type_code, expires_on')
      .is('revoked_at', null).gte('expires_on', new Date().toISOString().slice(0, 10)).lte('expires_on', month)
      .order('expires_on'))
      .then((r) => setAuths((r.data ?? []) as unknown as AuthDue[]));
  }, [rows]);

  const alerts: Alert[] = [];
  for (const r of rows) {
    if (r.status === 'AOG' || r.status === 'US') {
      alerts.push({
        level: r.status === 'AOG' ? 'aog' : 'us', ref: r.tail, to: `/aircraft/${r.aircraft_id}`,
        text: r.blocked_by
          ? `${r.blocked_by}${r.blocked_since ? `, ${heldFor(r.blocked_since, now)}` : ''}`
          : `${r.status === 'AOG' ? 'AOG' : 'Unserviceable'}${r.status_set_at ? ` for ${heldFor(r.status_set_at, now)}` : ''}`,
        owner: r.blocked_holder ?? 'Engineering', sort: new Date(r.blocked_since ?? r.status_set_at ?? 0).getTime(),
      });
    }
    if (r.snag_display === 'snag_open') {
      const since = r.blocked_by?.startsWith('Snag open') ? r.blocked_since : null;
      alerts.push({
        level: 'open', ref: r.tail, to: `/snags?aircraft=${r.aircraft_id}`,
        text: `Snag unassessed${since ? ` for ${heldFor(since, now)}` : ''}`,
        owner: 'Engineering', sort: new Date(since ?? 0).getTime(),
      });
    }
    if (r.next_nadd_due && new Date(r.next_nadd_due).getTime() - now.getTime() < 3 * DAY) {
      alerts.push({
        level: 'due', ref: r.tail, to: `/nadds?aircraft=${r.aircraft_id}`,
        text: `NADD due ${dueText(r.next_nadd_due, now)}`, owner: 'Engineering',
        sort: new Date(r.next_nadd_due).getTime(),
      });
    }
  }
  for (const e of ddls) {
    const what = e.kind === 'mel' ? `MEL${e.mel_category ? ` Cat ${e.mel_category}` : ''} deferral` : 'DDLS deferral';
    alerts.push({
      level: 'due', ref: e.aircraft?.tail ?? 'DDLS', to: `/ddls?aircraft=${e.aircraft_id}`,
      text: `${what} due ${dueText(e.due_at, now)}`, owner: 'Engineering', sort: new Date(e.due_at).getTime(),
    });
  }
  if (approvals > 0) {
    alerts.push({
      level: 'approval', ref: 'YOU', to: '/approvals',
      text: `${approvals} approval${approvals > 1 ? 's' : ''} waiting for your PIN`, owner: 'You', sort: 0,
    });
  }
  for (const a of auths) {
    alerts.push({
      level: 'expiry', ref: 'AUTH', to: '/section/QUA/authorizations',
      text: `A certifying authorization (${a.aircraft_type_code}) expires ${formatPlainDate(a.expires_on, display)}`,
      owner: 'Quality', sort: new Date(a.expires_on).getTime(),
    });
  }
  alerts.sort((x, y) => ORDER.indexOf(x.level) - ORDER.indexOf(y.level) || x.sort - y.sort);

  return (
    <aside className="attention" aria-label="Needs attention">
      <h2>Needs attention</h2>
      {alerts.map((a, i) => (
        <Link key={i} to={a.to} className="alert">
          <div className="alert-top">
            <span className={`alert-level lv-${a.level}`}>{LEVEL_TEXT[a.level]}</span>
            <span className="alert-ref">{a.ref}</span>
          </div>
          <div className="alert-text">{a.text}</div>
          <div className="alert-owner">Owner: {a.owner}</div>
        </Link>
      ))}
      {alerts.length === 0 && <p className="clear-line" style={{ margin: 0 }}>Nothing needs attention right now.</p>}
      <p className="attention-foot">Linked departments: Engineering · Supply · Procurement · Operations</p>
    </aside>
  );
}
