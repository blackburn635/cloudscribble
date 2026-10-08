/**
 * Synthetic planner-page generator for scan-accuracy evals.
 *
 * Renders planner layouts as HTML with handwriting fonts, applies "phone photo" effects
 * (tilt, perspective, shadow, blur, noise, sometimes 90° rotation), screenshots with
 * headless Chromium, and writes the answer key alongside.
 *
 *   npm run generate            → synthetic/*.jpg + synthetic/answers.json
 *   SEED=42 npm run generate    → different but reproducible set
 *
 * Answer-key conventions (must match the scan prompt):
 *   - Times are 24h "HH:MM". Bare hours with no am/pm: 7–11 → am, 12–6 → pm.
 *   - Crossed-out entries are listed in mustNotInclude.
 *   - "Things to do" items are listed in todos (not events).
 *   - Pages without a printed year resolve to the year of scanDate.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'synthetic');
const fontsDir = join(here, 'node_modules', '@fontsource');

// ---------------------------------------------------------------- RNG
let seed = Number(process.env.SEED || 20261008);
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
const chance = (p) => rand() < p;

// ---------------------------------------------------------------- Dates
const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const mondayOf = (d) => addDays(d, -((d.getUTCDay() + 6) % 7));
const randomDate = () => new Date(Date.UTC(2025 + Math.floor(rand() * 3), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)));

// ---------------------------------------------------------------- Content pools
const TIMED = ['Dentist', 'Soccer practice', 'Piano lesson', 'Team meeting', 'Lunch w/ Sarah', 'Dr. Patel', 'Haircut',
  'Book club', 'Parent-teacher conf', 'Gym', 'Vet - Max', 'Coffee w/ Jen', 'Swim lessons', 'Oil change',
  "Dinner @ Mom's", 'Choir', 'Budget review', 'Zoom w/ client', 'Yoga', 'Orthodontist', 'Scouts', 'Tutoring'];
const ALL_DAY = ["Mom's birthday", 'No school', 'Trash day', 'Payday', 'Field trip', 'Anniversary!', 'Spirit week - wear red',
  'Dad in Denver', 'Teacher workday', 'Rent due', 'Grandma visiting', 'Early release'];
const TODOS = ['call plumber', 'buy stamps', 'return library books', 'pay water bill', 'order cake', 'email coach', 'groceries'];
const INKS = ['#1b2a6b', '#1b2a6b', '#111111', '#111111', '#b3202a', '#1f6b3a', '#6b6b6b', '#5a2a82'];
const FONTS = ['caveat', 'homemade-apple', 'nanum-pen-script', 'reenie-beanie', 'shadows-into-light', 'indie-flower', 'patrick-hand', 'gochi-hand', 'kalam'];
const FONT_SCALE = { 'homemade-apple': 0.72, 'reenie-beanie': 1.25, 'nanum-pen-script': 1.3, 'kalam': 0.85 };

// ---------------------------------------------------------------- Time formatting
const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const h12 = (h) => ((h + 11) % 12) + 1;
const ap = (h, style) => (style === 'upper' ? (h < 12 ? ' AM' : ' PM') : (h < 12 ? 'am' : 'pm'));
/** Bare hours are only written when the convention resolves them correctly. */
const bareOk = (h) => h >= 7 && h <= 18;

function formatTime(h, m, end) {
  const clock = (hh, mm, withMer) => {
    const base = mm === 0 && chance(0.5) ? `${h12(hh)}` : `${h12(hh)}:${String(mm).padStart(2, '0')}`;
    return withMer ? base + ap(hh, chance(0.3) ? 'upper' : 'lower') : base;
  };
  if (h === 12 && m === 0 && !end && chance(0.25)) return 'noon';
  const mer = !bareOk(h) || (end && !bareOk(end[0])) || chance(0.5);
  if (!end) return clock(h, m, mer);
  return `${clock(h, m, false)}${pick(['-', ' - ', '–'])}${clock(end[0], end[1], mer)}`;
}

function makeTimedEvent(date) {
  const h = Math.floor(between(7, 20.5));
  const m = pick([0, 0, 0, 15, 30, 30, 45]);
  const end = chance(0.35) ? [Math.min(h + pick([1, 1, 2]), 21), pick([0, 0, 30])] : null;
  const title = pick(TIMED);
  const t = formatTime(h, m, end);
  const text = pick([`${t} ${title}`, `${title} - ${t}`, `${title} @ ${t}`, `${title} ${t}`]);
  return { text, truth: { date, title, start: hhmm(h, m), ...(end ? { end: hhmm(end[0], end[1]) } : {}) } };
}

const makeAllDay = (date) => {
  const title = pick(ALL_DAY);
  return { text: title, truth: { date, title, allDay: true } };
};

function makeEntries(date, max) {
  const out = [];
  const n = Math.floor(between(0, max + 1));
  for (let i = 0; i < n; i++) out.push(chance(0.78) ? makeTimedEvent(date) : makeAllDay(date));
  return out;
}

// ---------------------------------------------------------------- Ink rendering
function ink(text, { size = 26, struck = false, font, color, wrap = false } = {}) {
  const f = font || pick(FONTS);
  const px = Math.round(size * (FONT_SCALE[f] || 1) * between(0.92, 1.1));
  const rot = between(-2.5, 2.5).toFixed(2);
  const strike = struck ? 'text-decoration: line-through; text-decoration-thickness: 3px;' : '';
  const flow = wrap ? 'white-space:normal;overflow-wrap:anywhere;margin-left:2px;' : `margin-left:${Math.round(between(4, 30))}px;`;
  return `<div class="ink" style="font-family:'${f}';font-size:${px}px;color:${color || pick(INKS)};transform:rotate(${rot}deg);${flow}${strike}">${text}</div>`;
}

/** Render entries for one cell; records truths, crossed-out items, and returns HTML. */
function cell(entries, page, opts = {}) {
  return entries.map((e) => {
    const struck = chance(0.08);
    if (struck) page.mustNotInclude.push(`${e.truth.title} on ${e.truth.date} (crossed out)`);
    else page.events.push(e.truth);
    return ink(e.text, { struck, ...opts });
  }).join('');
}

// ---------------------------------------------------------------- Layouts
const CSS_BASE = `
  .page{position:relative;width:850px;height:1100px;background:#fdfdfb;box-sizing:border-box;font-family:Georgia,serif;color:#333}
  .ink{white-space:nowrap;line-height:1.15;margin-top:6px}
  .lined{background-image:repeating-linear-gradient(#fdfdfb 0 27px,#c9d3dc 27px 28px)}
`;

/** CloudScribble weekly (one half of the spread): header, 3–4 day rows, "Things to do" column. */
function csWeekly(start, half) {
  const page = { layout: 'cs-weekly', events: [], mustNotInclude: [], todos: [] };
  const end = addDays(start, 6);
  const days = half === 'left' ? [0, 1, 2] : [3, 4, 5, 6];
  const range = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}-${end.getUTCDate()}`;
  const rows = days.map((offset) => {
    const d = addDays(start, offset);
    const date = iso(d);
    const todos = chance(0.4) ? [pick(TODOS)] : [];
    page.todos.push(...todos.map((t) => ({ date, title: t })));
    return `<div style="flex:1;display:flex;border-top:2px solid #2f4a6b">
      <div style="flex:1;padding:8px 12px"><div style="font-style:italic;font-size:15px">${DAYS[d.getUTCDay()]} ${ordinal(d.getUTCDate())}</div>${cell(makeEntries(date, 3), page)}</div>
      <div style="flex:1;padding:8px 12px;border-left:2px dashed #9aa"><div style="font-style:italic;font-size:13px;text-align:center">Things to do</div>${todos.map((t) => ink('☐ ' + t, { size: 22 })).join('')}</div>
    </div>`;
  }).join('');
  page.html = `<div class="page" style="display:flex;flex-direction:column;padding:40px 50px;border:2px solid #222">
    <div style="display:flex;justify-content:space-between;font-style:italic;font-size:22px;margin-bottom:14px"><span>${range}</span><span>${start.getUTCFullYear()}</span><span>〰</span></div>${rows}</div>`;
  page.description = `CloudScribble weekly (${half} page), week of ${iso(start)}`;
  return page;
}

/** Generic lined weekly: month header + 3 days per page with lined writing space. */
function linedWeekly(start) {
  const page = { layout: 'lined-weekly', events: [], mustNotInclude: [], todos: [] };
  const rows = [0, 1, 2].map((offset) => {
    const d = addDays(start, offset);
    return `<div class="lined" style="flex:1;border-top:2px solid #3b5a9a;padding:6px 18px">
      <div style="font-family:Arial,sans-serif;font-weight:bold;font-size:13px;letter-spacing:1px">${DAYS[d.getUTCDay()].toUpperCase()}, ${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCDate()}</div>${cell(makeEntries(iso(d), 4), page)}</div>`;
  }).join('');
  page.html = `<div class="page" style="display:flex;flex-direction:column;padding:40px 46px">
    <div style="font-family:'caveat';color:#2a4a8a;font-size:54px;font-weight:bold">${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}</div>${rows}</div>`;
  page.description = `Lined weekly, ${iso(start)} to ${iso(addDays(start, 2))}`;
  return page;
}

/** Daily hourly page: times implied by the hour line an entry is written on. */
function dailyHourly(d) {
  const page = { layout: 'daily-hourly', events: [], mustNotInclude: [], todos: [] };
  const date = iso(d);
  const used = new Set();
  const lines = [];
  for (let h = 7; h <= 20; h++) {
    let content = '';
    if (!used.has(h) && chance(0.28)) {
      used.add(h);
      const title = pick(TIMED);
      const struck = chance(0.08);
      if (struck) page.mustNotInclude.push(`${title} on ${date} (crossed out)`);
      else page.events.push({ date, title, start: hhmm(h, 0) });
      content = ink(title, { struck, size: 28 });
    }
    lines.push(`<div style="display:flex;align-items:flex-end;height:62px;border-bottom:1px solid #c9d3dc">
      <div style="width:56px;font-family:Arial,sans-serif;font-size:14px;color:#777">${h12(h)}${h < 12 ? 'am' : 'pm'}</div><div style="flex:1">${content}</div></div>`);
  }
  const showYear = chance(0.8);
  page.html = `<div class="page" style="padding:44px 56px">
    <div style="font-family:Arial,sans-serif;font-size:30px;font-weight:bold;margin-bottom:6px">${DAYS[d.getUTCDay()]}</div>
    <div style="font-family:Arial,sans-serif;font-size:18px;color:#555;margin-bottom:16px">${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${showYear ? ', ' + d.getUTCFullYear() : ''}</div>${lines.join('')}</div>`;
  page.description = `Daily hourly, ${date}${showYear ? '' : ' (no year printed)'}`;
  page.noYear = !showYear;
  return page;
}

/** Monthly grid: dates implied by the cell; short entries. */
function monthlyGrid(anyDay) {
  const page = { layout: 'monthly-grid', events: [], mustNotInclude: [], todos: [] };
  const first = new Date(Date.UTC(anyDay.getUTCFullYear(), anyDay.getUTCMonth(), 1));
  const gridStart = addDays(first, -first.getUTCDay());
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const d = addDays(gridStart, i);
    const inMonth = d.getUTCMonth() === first.getUTCMonth();
    const entries = inMonth && chance(0.3) ? makeEntries(iso(d), 1).slice(0, 1) : [];
    cells.push(`<div style="border:1px solid #bbb;padding:4px;${inMonth ? '' : 'background:#f1f1ee;color:#bbb'}">
      <div style="font-family:Arial,sans-serif;font-size:13px">${d.getUTCDate()}</div>${cell(entries, page, { size: 18, wrap: true })}</div>`);
  }
  page.html = `<div class="page" style="padding:40px 36px;display:flex;flex-direction:column">
    <div style="font-family:Georgia,serif;font-size:40px;text-align:center;margin-bottom:10px">${MONTHS[first.getUTCMonth()]} ${first.getUTCFullYear()}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);font-family:Arial,sans-serif;font-size:12px;text-align:center;margin-bottom:4px">${DAYS.map((x) => `<div>${x.slice(0, 3).toUpperCase()}</div>`).join('')}</div>
    <div style="flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(5,1fr)">${cells.join('')}</div></div>`;
  page.description = `Monthly grid, ${MONTHS[first.getUTCMonth()]} ${first.getUTCFullYear()}`;
  return page;
}

// ---------------------------------------------------------------- Photo effects
const SURFACES = [
  'radial-gradient(circle at 30% 20%,#efece6,#d8d3ca)',                     // bedsheet
  'repeating-linear-gradient(90deg,#5b4636 0 18px,#4e3b2d 18px 40px)',     // wood table
  'radial-gradient(circle at 60% 40%,#a5a7a6,#7d7f7e)',                     // grey couch
  'linear-gradient(135deg,#f5f5f2,#e3e1dc)',                                // countertop
];

function scene(page) {
  const rotate90 = chance(0.2);
  const tilt = between(-4, 4);
  const rx = between(-10, 10);
  const ry = between(-8, 8);
  const blur = chance(0.3) ? between(0.3, 1.0) : 0;
  const light = between(0.88, 1.06);
  const shadowSide = pick(['left', 'right', 'top', 'bottom']);
  const shadowStrength = between(0.05, 0.28);
  return `<!doctype html><html><head><style>
    ${FONTS.map((f) => `@font-face{font-family:'${f}';src:url('file://${fontsDir}/${f}/files/${f}-latin-400-normal.woff2')}`).join('\n')}
    ${CSS_BASE}
    html,body{margin:0;width:1176px;height:1568px;overflow:hidden;background:${pick(SURFACES)}}
    .frame{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;perspective:1400px}
    .tilt{transform:rotate(${rotate90 ? 90 + tilt : tilt}deg) rotateX(${rx}deg) rotateY(${ry}deg) scale(${rotate90 ? 1.05 : 1.2});box-shadow:0 18px 40px rgba(0,0,0,.35);filter:blur(${blur}px) brightness(${light})}
    .shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to ${shadowSide},rgba(0,0,0,${shadowStrength}),transparent 60%)}
    .noise{position:absolute;inset:0;pointer-events:none;opacity:.18;mix-blend-mode:multiply}
  </style></head><body>
    <div class="frame"><div class="tilt">${page.html}</div></div>
    <div class="shade"></div>
    <svg class="noise" width="1176" height="1568"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
  </body></html>`;
}

// ---------------------------------------------------------------- Main
const PLAN = [
  ...Array.from({ length: 4 }, () => () => csWeekly(mondayOf(randomDate()), 'left')),
  ...Array.from({ length: 4 }, () => () => csWeekly(mondayOf(randomDate()), 'right')),
  ...Array.from({ length: 6 }, () => () => linedWeekly(mondayOf(randomDate()))),
  ...Array.from({ length: 6 }, () => () => dailyHourly(randomDate())),
  ...Array.from({ length: 4 }, () => () => monthlyGrid(randomDate())),
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1176, height: 1568 } });
const tab = await ctx.newPage();
const answers = [];

for (const [i, build] of PLAN.entries()) {
  const page = build();
  // Scan date: shortly after the page's dates (so year inference works for no-year pages).
  const anchor = new Date(`${(page.events[0] || page.todos[0])?.date || '2026-01-01'}T12:00:00Z`);
  const scanDate = iso(addDays(anchor, Math.floor(between(-5, 10))));
  const file = `${String(i + 1).padStart(2, '0')}-${page.layout}.jpg`;
  const htmlPath = join(outDir, `.${i}.html`);
  writeFileSync(htmlPath, scene(page));
  await tab.goto(`file://${htmlPath}`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: join(outDir, file), type: 'jpeg', quality: 72 });
  rmSync(htmlPath);
  answers.push({
    file,
    layout: page.layout,
    description: page.description,
    scanDate,
    ...(page.noYear ? { noYearPrinted: true } : {}),
    events: page.events,
    mustNotInclude: page.mustNotInclude,
    todos: page.todos,
  });
}

await browser.close();
writeFileSync(join(outDir, 'answers.json'), JSON.stringify({ seed: Number(process.env.SEED || 20261008), pages: answers }, null, 2));
const total = answers.reduce((n, p) => n + p.events.length, 0);
console.log(`Generated ${answers.length} pages, ${total} events → ${outDir}`);
