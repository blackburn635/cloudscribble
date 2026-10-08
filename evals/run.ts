/**
 * Scan-accuracy eval: runs every page through backend/functions/scans/ai.ts (same prompt,
 * schema, and validation as the Lambda) for each model, scores against the answer keys,
 * and prints accuracy + cost.
 *
 *   AWS_PROFILE=cloudscribble AWS_REGION=us-east-2 npm run eval -- [--models a,b] [--set synthetic|real|all] [--limit N]
 *
 * Costs real money (Bedrock). Prices below are per 1M tokens — verify against current
 * Bedrock pricing before relying on the cost column.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runModel, scanPage, type ModelRun, type ScanModelConfig } from '../backend/functions/scans/ai';
import type { ScanEvent } from '@cloudscribble/shared';

const here = dirname(fileURLToPath(import.meta.url));

/** Models enabled for this account. Haiku 5.5 / Sonnet 5.x are AWS-gated for now — pass via --models once enabled. */
const DEFAULT_MODELS = [
  'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  'us.anthropic.claude-sonnet-4-6',
];

/** USD per 1M tokens (input, output). VERIFY against Bedrock pricing; missing = unknown. */
const PRICES: Record<string, { in: number; out: number } | null> = {
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { in: 1, out: 5 },
  'us.anthropic.claude-sonnet-4-6': { in: 3, out: 15 },
  'us.anthropic.claude-sonnet-5-5': { in: 2, out: 10 },
};

interface Truth {
  date: string;
  title: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  accept?: string;
}
interface Page {
  file: string;
  scanDate?: string;
  events: Truth[];
  mustNotInclude: string[];
  todos?: { date: string; title: string }[];
}

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
/** --tiered: run production tiering (scanPage) instead of single models. Mirrors the Lambda env. */
const TIERED: ScanModelConfig = {
  primary: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  fallback: 'us.anthropic.claude-sonnet-4-6',
  fallbackBelow: 0.9,
  fallbackEffort: 'low',
};
const tiered = args.includes('--tiered');
const models = tiered ? ['tiered'] : (arg('models')?.split(',') ?? DEFAULT_MODELS);
const set = arg('set') ?? 'all';
const limit = Number(arg('limit') ?? Infinity);

function loadPages(dir: 'synthetic' | 'real'): (Page & { dir: string })[] {
  try {
    const raw = JSON.parse(readFileSync(join(here, dir, 'answers.json'), 'utf8'));
    return raw.pages.map((p: Page) => ({ ...p, dir }));
  } catch {
    return [];
  }
}
const pages = [
  ...(set !== 'real' ? loadPages('synthetic') : []),
  ...(set !== 'synthetic' ? loadPages('real') : []),
].slice(0, limit);

// ---------------------------------------------------------------- scoring
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
function titleSim(a: string, b: string): number {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.max(A.size, B.size);
}

interface PageScore {
  truth: number;
  found: number;
  timeRight: number;
  extra: number;
  struckLeaks: number;
  todoLeaks: number;
  misses: string[];
  extras: string[];
}

function scorePage(page: Page, pred: ScanEvent[]): PageScore {
  const used = new Set<number>();
  const s: PageScore = { truth: page.events.length, found: 0, timeRight: 0, extra: 0, struckLeaks: 0, todoLeaks: 0, misses: [], extras: [] };

  for (const t of page.events) {
    let best = -1;
    let bestSim = 0;
    pred.forEach((p, i) => {
      if (used.has(i) || p.date !== t.date) return;
      const sim = t.accept ? (p.title.toLowerCase().includes(t.title.toLowerCase()) ? 1 : 0) : titleSim(p.title, t.title);
      if (sim > bestSim) { bestSim = sim; best = i; }
    });
    if (best < 0 || bestSim < 0.5) {
      s.misses.push(`${t.date} ${t.start ?? 'all-day'} ${t.title}`);
      continue;
    }
    used.add(best);
    s.found++;
    const p = pred[best];
    if (t.accept) {
      // Sub-schedule: also absorb other predictions on that date that start with the heading.
      pred.forEach((q, i) => { if (q.date === t.date && q.title.toLowerCase().includes(t.title.toLowerCase())) used.add(i); });
      s.timeRight++;
    } else if (t.allDay ? p.allDay : (p.start === t.start && (!t.end || p.end === t.end))) {
      s.timeRight++;
    } else {
      s.misses.push(`time: ${t.date} ${t.title} want ${t.allDay ? 'all-day' : `${t.start}${t.end ? '-' + t.end : ''}`} got ${p.allDay ? 'all-day' : `${p.start}${p.end ? '-' + p.end : ''}`}`);
    }
  }

  pred.forEach((p, i) => {
    if (used.has(i)) return;
    s.extra++;
    s.extras.push(`${p.date} ${p.start ?? 'all-day'} ${p.title}`);
    if (page.mustNotInclude.some((m) => titleSim(m.split(' on ')[0], p.title) >= 0.5)) s.struckLeaks++;
    if (page.todos?.some((t) => t.date === p.date && titleSim(t.title, p.title) >= 0.5)) s.todoLeaks++;
  });
  return s;
}

// ---------------------------------------------------------------- run
const contentType = (f: string) => (f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg') as 'image/jpeg';
const today = new Date().toISOString().slice(0, 10);
const results: Record<string, unknown>[] = [];

console.log(`Eval: ${pages.length} pages × ${models.length} models\n`);

for (const model of models) {
  const totals = { truth: 0, found: 0, timeRight: 0, extra: 0, struckLeaks: 0, todoLeaks: 0, inTok: 0, outTok: 0, ms: 0, errors: 0, conf: 0, cost: 0, priced: true, fallbacks: 0 };
  for (const page of pages) {
    const image = { data: readFileSync(join(here, page.dir, page.file)), contentType: contentType(page.file) };
    const started = Date.now();
    try {
      let run: ModelRun;
      let allRuns: ModelRun[];
      if (tiered) {
        const scan = await scanPage(image, page.scanDate ?? today, TIERED, 60_000);
        run = scan.final;
        allRuns = scan.runs;
        if (scan.runs.length > 1) totals.fallbacks++;
      } else {
        run = await runModel(model, image, page.scanDate ?? today, { timeoutMs: 60_000 });
        allRuns = [run];
      }
      for (const r of allRuns) {
        const p = PRICES[r.model] ?? null;
        const inTok = r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0);
        if (p) totals.cost += (inTok * p.in + r.usage.output_tokens * p.out) / 1e6;
        else totals.priced = false;
      }
      const ms = Date.now() - started;
      const s = scorePage(page, run.result.events);
      totals.truth += s.truth; totals.found += s.found; totals.timeRight += s.timeRight; totals.extra += s.extra;
      totals.struckLeaks += s.struckLeaks; totals.todoLeaks += s.todoLeaks; totals.ms += ms; totals.conf += run.result.confidence;
      for (const r of allRuns) {
        totals.inTok += r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0);
        totals.outTok += r.usage.output_tokens;
      }
      results.push({
        model, page: `${page.dir}/${page.file}`, ms, finalModel: run.model, confidence: run.result.confidence,
        pageDates: run.result.pageDates, score: s, events: run.result.events,
        runs: allRuns.map((r) => ({ model: r.model, confidence: r.result.confidence, pageDates: r.result.pageDates, events: r.result.events.length })),
      });
      const via = tiered ? (allRuns.length > 1 ? ' [fallback]' : ' [primary]') : '';
      process.stdout.write(`  ${page.dir}/${page.file.padEnd(28)} ${s.found}/${s.truth} found, ${s.timeRight} time-ok, ${s.extra} extra, conf ${run.result.confidence.toFixed(2)}, ${ms}ms${via}\n`);
    } catch (err) {
      totals.errors++;
      results.push({ model, page: `${page.dir}/${page.file}`, error: String(err) });
      process.stdout.write(`  ${page.dir}/${page.file.padEnd(28)} ERROR ${(err as Error).message}\n`);
    }
  }
  const cost = totals.priced ? totals.cost : null;
  const ok = pages.length - totals.errors;
  console.log(`\n${model}
  recall      ${(100 * totals.found / Math.max(1, totals.truth)).toFixed(1)}%  (${totals.found}/${totals.truth} events found)
  exact time  ${(100 * totals.timeRight / Math.max(1, totals.truth)).toFixed(1)}%  of all events
  extras      ${totals.extra}  (crossed-out leaks ${totals.struckLeaks}, to-do leaks ${totals.todoLeaks})
  errors      ${totals.errors}${tiered ? `\n  fallbacks   ${totals.fallbacks}/${ok} pages (${(100 * totals.fallbacks / Math.max(1, ok)).toFixed(0)}%)` : ''}
  avg latency ${ok ? Math.round(totals.ms / ok) : '-'} ms, avg confidence ${ok ? (totals.conf / ok).toFixed(2) : '-'}
  tokens      ${totals.inTok} in / ${totals.outTok} out
  cost        ${cost === null ? 'price unknown' : `$${cost.toFixed(4)} total, $${(cost / Math.max(1, ok)).toFixed(5)}/scan`}\n`);
}

mkdirSync(join(here, 'results'), { recursive: true });
const out = join(here, 'results', `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`Details → ${out}`);
