/**
 * ScanSession — the in-progress scan shared by Camera → Scanning → Review.
 * Lives in memory only; nothing about events is stored on our servers.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ScanEvent, ScanResponse } from '@cloudscribble/shared';

export interface EditableEvent extends ScanEvent {
  /** Local key for list rendering/editing */
  key: string;
}

interface ScanSessionValue {
  photoUri: string | null;
  result: ScanResponse | null;
  events: EditableEvent[];
  remainingThisMonth: number | null;
  startScan: (photoUri: string) => void;
  setResult: (r: ScanResponse) => void;
  upsertEvent: (e: EditableEvent) => void;
  removeEvent: (key: string) => void;
  reset: () => void;
}

const Ctx = createContext<ScanSessionValue | null>(null);

export const useScanSession = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useScanSession must be used within ScanSessionProvider');
  return v;
};

let nextKey = 0;
export const newEventKey = () => `e${Date.now()}-${nextKey++}`;

export function ScanSessionProvider({ children }: { children: ReactNode }) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [result, setResultState] = useState<ScanResponse | null>(null);
  const [events, setEvents] = useState<EditableEvent[]>([]);
  const [remainingThisMonth, setRemaining] = useState<number | null>(null);

  const startScan = useCallback((uri: string) => {
    setPhotoUri(uri);
    setResultState(null);
    setEvents([]);
  }, []);

  const setResult = useCallback((r: ScanResponse) => {
    setResultState(r);
    setRemaining(r.remainingThisMonth);
    setEvents(r.events.map((e) => ({ ...e, key: newEventKey() })));
  }, []);

  const upsertEvent = useCallback((e: EditableEvent) => {
    setEvents((prev) => (prev.some((p) => p.key === e.key) ? prev.map((p) => (p.key === e.key ? e : p)) : [...prev, e]));
  }, []);

  const removeEvent = useCallback((key: string) => setEvents((prev) => prev.filter((p) => p.key !== key)), []);

  const reset = useCallback(() => {
    setPhotoUri(null);
    setResultState(null);
    setEvents([]);
  }, []);

  const value = useMemo(
    () => ({ photoUri, result, events, remainingThisMonth, startScan, setResult, upsertEvent, removeEvent, reset }),
    [photoUri, result, events, remainingThisMonth, startScan, setResult, upsertEvent, removeEvent, reset]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
