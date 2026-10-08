// One door for every action the screens take (D-102 to D-105, D-217).
//
//   Online           → sent straight to the server, as before.
//   No connection:
//     reports, attends, work entries        → queued, sent later (D-103)
//     signatures (dispositions, clearing,
//     certifying, tail status)              → signed offline on an enrolled
//                                             tablet, queued, checked by the
//                                             server later (D-217)
//     everything else (approvals, requests) → "needs a connection"
//
// The PIN is used on the tablet to sign and is never stored or queued.
import { actions } from './supabase';
import { enqueue } from './offline/outbox';
import { isNetworkError, isOnline, setReachable } from './offline/net';
import { offlineSigningProblem, signOffline } from './offline/signing';

type Mode = 'queue' | 'sign';

export const OFFLINE_MODE: Record<string, Mode> = {
  report_snag: 'queue',
  propose_nadd: 'queue',
  attend_snag: 'queue',
  add_work_order_entry: 'queue',
  apply_mel: 'sign',
  defer_on_ddls: 'sign',
  defer_as_nadd: 'sign',
  close_snag_no_fault_found: 'sign',
  clear_ddls_entry: 'sign',
  confirm_nadd: 'sign',
  rectify_nadd: 'sign',
  certify_work_order: 'sign',
  set_tail_status: 'sign',
};

let currentUser: string | undefined;
export function setCurrentUser(id: string | undefined): void {
  currentUser = id;
}
export function getCurrentUser(): string | undefined {
  return currentUser;
}

export type Meta = { label: string; recordPath?: string; aircraftId?: string };
export type Outcome = { data?: unknown; error?: { message: string }; queued?: 'queued' | 'signed-offline' };

export async function perform(action: string, args: Record<string, unknown>, meta: Meta): Promise<Outcome> {
  if (isOnline()) {
    const { data, error } = await actions.rpc(action as 'report_snag', args as never);
    if (!error) {
      setReachable(true);
      return { data };
    }
    if (!isNetworkError(error)) return { error: { message: error.message } };
    setReachable(false);
  }
  return performOffline(action, args, meta);
}

async function performOffline(action: string, args: Record<string, unknown>, meta: Meta): Promise<Outcome> {
  const mode = OFFLINE_MODE[action];
  if (!currentUser) return { error: { message: 'No connection.' } };
  if (mode === 'queue') {
    await enqueue({ userId: currentUser, kind: 'rpc', action, args, ...meta });
    return { queued: 'queued' };
  }
  if (mode === 'sign') {
    const problem = await offlineSigningProblem(currentUser);
    if (problem) return { error: { message: `No connection. ${problem}` } };
    const { p_pin, ...rest } = args;
    try {
      const signed = await signOffline(currentUser, String(p_pin ?? ''), action, rest);
      await enqueue({ userId: currentUser, kind: 'signed', action, args: rest, ...signed, ...meta });
      return { queued: 'signed-offline' };
    } catch (e) {
      return { error: { message: e instanceof Error ? e.message : String(e) } };
    }
  }
  return { error: { message: 'This needs a connection to the Nexus server (D-104, D-217).' } };
}

// The words shown after an action was queued instead of sent.
export function queuedText(o: { queued?: Outcome['queued'] }, what: string): string {
  return o.queued === 'signed-offline'
    ? `${what}: signed offline, provisional. It is sent and checked by the server when the connection returns (D-217).`
    : `${what}: queued, not sent. It is sent when the connection returns.`;
}
