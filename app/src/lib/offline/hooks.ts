// React hooks for the offline pieces: connection state, this person's send
// queue, and this tablet's status. Screens re-draw when any of them change.
import { useEffect, useState } from 'react';
import type { OutboxItem } from './db';
import { isOnline, onNetChange } from './net';
import { listOutbox, onOutboxChange } from './outbox';
import { deviceState, onDeviceChange, type DeviceState } from './device';
import { getCurrentUser } from '../perform';

export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => onNetChange(() => setOnline(isOnline())), []);
  return online;
}

export function useOutbox(): OutboxItem[] {
  const [items, setItems] = useState<OutboxItem[]>([]);
  useEffect(() => {
    const load = async () => {
      const id = getCurrentUser();
      setItems(id ? await listOutbox(id) : []);
    };
    load();
    return onOutboxChange(load);
  }, []);
  return items;
}

// Items still waiting (not yet accepted by the server) for one record.
export function usePendingFor(recordPath: string | undefined): OutboxItem[] {
  const items = useOutbox();
  return recordPath ? items.filter((i) => i.recordPath === recordPath && i.status !== 'sent') : [];
}

export function useDevice(): DeviceState {
  const [s, setS] = useState(deviceState());
  useEffect(() => onDeviceChange(() => setS(deviceState())), []);
  return s;
}
