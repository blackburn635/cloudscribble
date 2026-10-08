/**
 * Scan prompt + output schema. Kept byte-stable (no dates, no IDs) so the system
 * prompt can be prompt-cached; per-request facts go in the user message.
 *
 * The evals (evals/) score against these same conventions — change both together.
 */

export const SCAN_SYSTEM_PROMPT = `You read photos of paper planner pages and extract the calendar events the person wrote, so an app can add them to their phone calendar.

The photo may be rotated, taken at an angle, unevenly lit, or show a two-page spread. Any planner brand or layout is possible: weekly, daily, hourly, monthly grids, or a notebook page with dates written in.

Dates
- Work out each entry's date from the page itself: month/year headers, week ranges ("January 6-12"), day labels ("Tuesday 7th", "MONDAY, APRIL 11"), or the grid cell or column it sits in.
- If no year is printed, choose the year that puts the date closest to the user's local date given in the message.

Times (24-hour "HH:MM")
- Respect written am/pm. "noon" is 12:00, "midnight" is 00:00.
- A range like "3:15-4" or "5:00-6:30pm" gives start and end; a single am/pm applies to both sides.
- With no am/pm, use context (evening practice, dinner → pm; breakfast, school drop-off → am). If context doesn't help: 9–11 → am, 12–5 → pm, 6–8 → pm.
- On hourly layouts, an entry written on an hour line starts at that hour unless it states its own time.
- No time written → all-day event (start and end null).

What to include
- Only entries a person added to the page (handwriting, stickers, or typed notes). Ignore the planner's pre-printed text.
- When a heading has timed sub-items under it on the same day, create one event per timed sub-item, titled "<heading> - <sub-item>".

What to ignore
- Crossed-out or scribbled-over entries.
- Faint bleed-through from the other side of the paper.
- To-do lists, checklists, "Things to do" / notes sections, and anything outside the planner page (loose papers, objects).

Titles
- Transcribe what was written, without the time. Fix obvious misspellings ("Denist" → "Dentist"); keep names and abbreviations as written.
- Put extra details that follow the main title in note only when they are clearly separate (e.g. "bring snacks"); otherwise leave note null.

Confidence
- Give each event a confidence from 0 to 1 for its date, time, and title together.
- Give an overall confidence for the whole page.
- If the image is not a planner or calendar page, or is too blurry to read, set readable to false and return no events.

Respond only with JSON matching the schema.`;

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };

export const SCAN_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'confidence', 'events'],
  properties: {
    readable: { type: 'boolean' },
    confidence: { type: 'number' },
    events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'date', 'start', 'end', 'allDay', 'note', 'confidence'],
        properties: {
          title: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          start: { ...nullableString, description: 'HH:MM 24h, null for all-day' },
          end: { ...nullableString, description: 'HH:MM 24h, null if not written' },
          allDay: { type: 'boolean' },
          note: nullableString,
          confidence: { type: 'number' },
        },
      },
    },
  },
} as const;

export function scanUserText(localDate: string): string {
  return `The user's local date is ${localDate}. Extract the events from this planner page.`;
}
