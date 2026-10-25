/**
 * Device calendar access (expo-calendar) + local records of the events this app created.
 * Nothing here leaves the device.
 */
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanEvent } from '@cloudscribble/shared';
import { planSync, type CalendarEventLite, type CreatedRecord, type SyncPlan } from './syncPlan';

const DEFAULT_DURATION_MIN = 60;
const ALERT_MINUTES_BEFORE = 30;
const LAST_CALENDAR_KEY = 'cs.lastCalendarId';
const recordsKey = (calendarId: string, start: string, end: string) => `cs.page.${calendarId}.${start}.${end}`;

export interface WritableCalendar {
  id: string;
  title: string;
  color: string;
  source: string;
}

export async function ensureCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export async function listWritableCalendars(): Promise<WritableCalendar[]> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals
    .filter((c) => c.allowsModifications)
    .map((c) => ({ id: c.id, title: c.title, color: c.color ?? '#6774c8', source: c.source?.name ?? '' }))
    .sort((a, b) => a.source.localeCompare(b.source) || a.title.localeCompare(b.title));
}

export const getLastCalendarId = () => AsyncStorage.getItem(LAST_CALENDAR_KEY);
export const setLastCalendarId = (id: string) => AsyncStorage.setItem(LAST_CALENDAR_KEY, id);

// ---------------------------------------------------------------- dates
function localDate(date: string, time?: string | null): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Page date range: printed dates when available, else the span of the events. */
export function pageRange(events: ScanEvent[], pageDates: { start: string; end: string } | null) {
  if (pageDates) return pageDates;
  const dates = events.map((e) => e.date).sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

function toEventDetails(ev: ScanEvent): Omit<Partial<Calendar.Event>, 'id' | 'organizer'> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (ev.allDay || !ev.start) {
    const day = localDate(ev.date);
    return { title: ev.title, notes: ev.note ?? undefined, allDay: true, startDate: day, endDate: day, timeZone, alarms: [] };
  }
  const start = localDate(ev.date, ev.start);
  const end = ev.end ? localDate(ev.date, ev.end) : new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);
  return {
    title: ev.title,
    notes: ev.note ?? undefined,
    allDay: false,
    startDate: start,
    endDate: end,
    timeZone,
    alarms: [{ relativeOffset: -ALERT_MINUTES_BEFORE }],
  };
}

// ---------------------------------------------------------------- records
async function loadRecords(calendarId: string, start: string, end: string): Promise<CreatedRecord[]> {
  const raw = await AsyncStorage.getItem(recordsKey(calendarId, start, end));
  const records: CreatedRecord[] = raw ? JSON.parse(raw) : [];
  // Drop records whose events the user already deleted in their calendar app.
  const alive = await Promise.all(
    records.map(async (r) => {
      try {
        await Calendar.getEventAsync(r.eventId);
        return r;
      } catch {
        return null;
      }
    })
  );
  return alive.filter((r): r is CreatedRecord => r !== null);
}

const saveRecords = (calendarId: string, start: string, end: string, records: CreatedRecord[]) =>
  AsyncStorage.setItem(recordsKey(calendarId, start, end), JSON.stringify(records));

async function eventsInRange(calendarId: string, start: string, end: string): Promise<CalendarEventLite[]> {
  const from = localDate(start);
  const to = new Date(localDate(end).getTime() + 86_400_000);
  const events = await Calendar.getEventsAsync([calendarId], from, to);
  return events.map((e) => {
    const s = new Date(e.startDate);
    return { id: e.id, title: e.title, date: ymd(s), start: e.allDay ? null : hm(s) };
  });
}

// ---------------------------------------------------------------- sync
export interface PreparedSync {
  calendarId: string;
  range: { start: string; end: string };
  plan: SyncPlan;
  records: CreatedRecord[];
}

/** Read-only: work out what saving would do (shown to the user before anything changes). */
export async function prepareSync(calendarId: string, events: ScanEvent[], pageDates: { start: string; end: string } | null): Promise<PreparedSync> {
  const range = pageRange(events, pageDates);
  const records = await loadRecords(calendarId, range.start, range.end);
  const existing = await eventsInRange(calendarId, range.start, range.end);
  return { calendarId, range, records, plan: planSync(events, records, existing) };
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
}

/** Apply the plan. `deleteIds` must come from plan.deleteCandidates (app-created events only). */
export async function applySync(prep: PreparedSync, deleteIds: string[]): Promise<SyncResult> {
  const { calendarId, range, plan } = prep;
  const allowedDeletes = new Set(plan.deleteCandidates.map((r) => r.eventId));
  const next: CreatedRecord[] = [];
  const result: SyncResult = { created: 0, updated: 0, deleted: 0 };

  for (const { eventId, event } of plan.unchanged) next.push({ eventId, title: event.title, date: event.date, start: event.start });

  for (const { eventId, event } of plan.update) {
    await Calendar.updateEventAsync(eventId, toEventDetails(event));
    next.push({ eventId, title: event.title, date: event.date, start: event.start });
    result.updated++;
  }

  for (const event of plan.create) {
    const eventId = await Calendar.createEventAsync(calendarId, toEventDetails(event));
    next.push({ eventId, title: event.title, date: event.date, start: event.start });
    result.created++;
  }

  for (const r of plan.deleteCandidates) {
    if (deleteIds.includes(r.eventId) && allowedDeletes.has(r.eventId)) {
      await Calendar.deleteEventAsync(r.eventId).catch(() => undefined);
      result.deleted++;
    } else {
      next.push(r); // kept — still ours, so a later rescan can still match it
    }
  }

  await saveRecords(calendarId, range.start, range.end, next);
  await setLastCalendarId(calendarId);
  return result;
}
