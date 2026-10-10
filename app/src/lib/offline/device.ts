// This tablet (D-217, Q-OS1: line tablets only).
//
// A tablet is registered once (it gets an id, kept on the tablet), then a
// Super Admin of Engineering enrols it. Each time the tablet reaches the
// server it "checks in": the server notes the contact and replies with the
// tablet's status and the server time (for the offline clock).
import { actions } from '../supabase';
import { getMeta, setMeta } from './db';
import { noteServerTime } from './clock';
import { isNetworkError, setReachable } from './net';

export type DeviceState = {
  deviceId: string | null;
  label: string | null;
  problem: string | null;   // null = enrolled and usable
  hasKey: boolean;          // offline signing switched on for me here
  maxHours: number;
  checkedAt: number | null;
};

let state: DeviceState = { deviceId: null, label: null, problem: 'Not checked yet.', hasKey: false, maxHours: 72, checkedAt: null };
const listeners = new Set<() => void>();

export function deviceState(): DeviceState {
  return state;
}

export function onDeviceChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function update(next: Partial<DeviceState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export async function loadDevice(): Promise<void> {
  update({
    deviceId: (await getMeta<string>('deviceId')) ?? null,
    label: (await getMeta<string>('deviceLabel')) ?? null,
    hasKey: (await getMeta<boolean>('hasKey')) ?? false,
    maxHours: (await getMeta<number>('maxHours')) ?? 72,
  });
}

export async function registerDevice(label: string): Promise<string | null> {
  const { data, error } = await actions.rpc('request_device', { p_label: label });
  if (error) return error.message;
  await setMeta('deviceId', data as string);
  await setMeta('deviceLabel', label);
  await loadDevice();
  await checkIn();
  return null;
}

export async function checkIn(): Promise<boolean> {
  // Unregistered devices send null: still useful, it sets the server clock.
  const { data, error } = await actions.rpc('device_checkin', { p_device: state.deviceId ?? null } as unknown as { p_device: string });
  if (error) {
    if (isNetworkError(error)) setReachable(false);
    return false;
  }
  setReachable(true);
  const r = data as { server_time: string; problem: string | null; has_key: boolean; max_hours: number };
  await noteServerTime(r.server_time);
  await setMeta('hasKey', r.has_key);
  await setMeta('maxHours', r.max_hours);
  update({ problem: r.problem, hasKey: r.has_key, maxHours: r.max_hours, checkedAt: Date.now() });
  await setMeta('deviceProblem', r.problem);
  return true;
}

// Offline, use what the tablet last heard.
export async function loadLastKnownProblem(): Promise<void> {
  const p = await getMeta<string | null>('deviceProblem');
  if (p !== undefined) update({ problem: p });
}
