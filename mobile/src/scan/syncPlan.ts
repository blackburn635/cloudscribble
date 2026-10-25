/**
 * Pure rescan logic (no device APIs) — what to create, update, offer to delete, and remind.
 *
 * Rules (CLAUDE.md "Scan flow"):
 *  - Matching is on-device: records of events this app created, keyed by calendar + page dates.
 *  - Only events the app created may be offered for deletion.
 *  - Other calendar events in the page's date range are read-only "write in your planner" reminders.
 */
import type { ScanEvent } from '@cloudscribble/shared';

/** One event the app created from a page (stored locally). */
export interface CreatedRecord {
  eventId: string;
  title: string;
  date: string;
  start: string | null;
}

/** A calendar event as read from the device (subset). */
export interface CalendarEventLite {
  id: string;
  title: string;
  date: string; // local YYYY-MM-DD of the start
  start: string | null; // local HH:MM, null when all-day
}

export interface SyncPlan {
  create: ScanEvent[];
  update: { eventId: string; event: ScanEvent }[];
  unchanged: { eventId: string; event: ScanEvent }[];
  /** App-created events from this page that are no longer on it — user decides. */
  deleteCandidates: CreatedRecord[];
  /** Events from elsewhere in this date range that aren't on the page — reminders only. */
  writeInPlanner: CalendarEventLite[];
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

export function titleSimilarity(a: string, b: string): number {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.max(A.size, B.size);
}

const SAME = 0.5;

export function planSync(
  scanned: ScanEvent[],
  records: CreatedRecord[],
  existingInRange: CalendarEventLite[]
): SyncPlan {
  const plan: SyncPlan = { create: [], update: [], unchanged: [], deleteCandidates: [], writeInPlanner: [] };
  const usedRecords = new Set<string>();

  for (const ev of scanned) {
    // Best record on the same date by title (prefer same start time on ties).
    let best: CreatedRecord | undefined;
    let bestScore = 0;
    for (const r of records) {
      if (usedRecords.has(r.eventId) || r.date !== ev.date) continue;
      const score = titleSimilarity(r.title, ev.title) + (r.start === ev.start ? 0.01 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    if (best && bestScore >= SAME) {
      usedRecords.add(best.eventId);
      const changed = best.title !== ev.title || best.start !== ev.start;
      (changed ? plan.update : plan.unchanged).push({ eventId: best.eventId, event: ev });
    } else {
      plan.create.push(ev);
    }
  }

  plan.deleteCandidates = records.filter((r) => !usedRecords.has(r.eventId));

  const appCreated = new Set(records.map((r) => r.eventId));
  plan.writeInPlanner = existingInRange.filter(
    (e) =>
      !appCreated.has(e.id) &&
      !scanned.some((s) => s.date === e.date && titleSimilarity(s.title, e.title) >= SAME)
  );

  return plan;
}
