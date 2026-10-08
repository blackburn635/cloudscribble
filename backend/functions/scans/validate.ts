/**
 * Normalize and validate model output into a ScanResult. Never trust the model's JSON:
 * bad dates/times are dropped or repaired, numbers clamped, sizes capped.
 */

import type { ScanEvent, ScanResult } from '@cloudscribble/shared';

const MAX_EVENTS = 60;
const MAX_TITLE = 200;
const MAX_NOTE = 500;

const clamp01 = (n: unknown) => {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.min(1, Math.max(0, x));
};

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Accepts "H:MM" or "HH:MM"; returns zero-padded "HH:MM" or null. */
export function normalizeTime(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

const cleanText = (s: unknown, max: number) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const TIME = String.raw`(?<!\d)(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?`;
const RANGE = String.raw`${TIME}(?:\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?`;
const LEADING_TIME = new RegExp(String.raw`^(?:@\s*)?${RANGE}\s+`, 'i');
const TRAILING_TIME = new RegExp(String.raw`\s*(?:[-–@]\s*)?${RANGE}$`, 'i');

/**
 * Remove a time the model left in the title ("Soccer - 7:30" → "Soccer") when the event
 * already has a start time. A bare trailing number is only stripped when it matches the
 * start hour, so titles like "Ward 5" survive.
 */
export function stripTimeFromTitle(title: string, start: string | null): string {
  if (!start) return title;
  const startHour12 = ((Number(start.slice(0, 2)) + 11) % 12) + 1;
  let out = title;
  for (const re of [LEADING_TIME, TRAILING_TIME]) {
    const m = re.exec(out);
    if (!m) continue;
    const explicit = m[2] !== undefined || m[3] !== undefined || /[-–]\s*\d/.test(m[0]);
    if (!explicit && Number(m[1]) !== startHour12) continue;
    const next = out.replace(re, '').replace(/\s*[-–@:]\s*$/, '').trim();
    if (next) out = next;
  }
  return out;
}

function normalizePageDates(raw: unknown): ScanResult['pageDates'] {
  if (!raw || typeof raw !== 'object') return null;
  const { start, end } = raw as Record<string, unknown>;
  if (!isValidDate(start) || !isValidDate(end) || end < start) return null;
  return { start, end };
}

const MAX_PAGE_SPAN_DAYS = 45;

/**
 * Cheap self-consistency check used for tiering: do the events fall inside the page's own
 * printed date range? A whole-page date misread (wrong week/year) fails this even when the
 * model reports high confidence.
 */
export function datesConsistent(result: ScanResult): boolean {
  if (!result.pageDates || result.events.length === 0) return true;
  const { start, end } = result.pageDates;
  const spanDays = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  if (spanDays > MAX_PAGE_SPAN_DAYS) return false;
  return result.events.every((e) => e.date >= start && e.date <= end);
}

function normalizeEvent(raw: unknown): ScanEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  let start = normalizeTime(r.start);
  const title = stripTimeFromTitle(cleanText(r.title, MAX_TITLE), start);
  if (!title || !isValidDate(r.date)) return null;

  let end = normalizeTime(r.end);
  let allDay = r.allDay === true || !start;
  if (allDay) {
    start = null;
    end = null;
  }
  if (end && start && end <= start) end = null; // e.g. misread range; keep the start
  const note = cleanText(r.note, MAX_NOTE) || null;

  return { title, date: r.date as string, start, end, allDay, note, confidence: clamp01(r.confidence) };
}

/** Parse model text into a ScanResult. Throws if no usable JSON object is present. */
export function parseScanResult(text: string): ScanResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first < 0 || last <= first) throw new Error('Model returned no JSON');
    json = JSON.parse(text.slice(first, last + 1));
  }
  if (!json || typeof json !== 'object') throw new Error('Model JSON is not an object');
  const o = json as Record<string, unknown>;

  const seen = new Set<string>();
  const events: ScanEvent[] = [];
  for (const raw of Array.isArray(o.events) ? o.events : []) {
    const e = normalizeEvent(raw);
    if (!e) continue;
    const key = `${e.date}|${e.start ?? ''}|${e.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(e);
    if (events.length >= MAX_EVENTS) break;
  }

  return {
    readable: o.readable !== false,
    events,
    confidence: clamp01(o.confidence),
    pageDates: normalizePageDates(o.pageDates),
  };
}
