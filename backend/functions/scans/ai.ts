/**
 * Bedrock (IAM auth) call for page scans, with tiering:
 *   primary model (cheap) → fallback model only when the page is unreadable or
 *   overall confidence is below SCAN_FALLBACK_BELOW.
 *
 * Model IDs are config (Bedrock inference-profile IDs, e.g. us.anthropic.claude-haiku-4-5-…);
 * verify they are current before each release.
 */

import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import type { ScanResult, ScanUploadContentType } from '@cloudscribble/shared';
import { SCAN_OUTPUT_SCHEMA, SCAN_SYSTEM_PROMPT, scanUserText } from './prompt';
import { datesConsistent, parseScanResult } from './validate';

export interface ScanModelConfig {
  primary: string;
  fallback?: string;
  /** Use the fallback when primary confidence is below this (0–1). */
  fallbackBelow: number;
  /** output_config.effort for the fallback (models that support effort); omitted when unset. */
  fallbackEffort?: 'low' | 'medium' | 'high';
}

export function modelConfigFromEnv(env = process.env): ScanModelConfig {
  if (!env.SCAN_MODEL_PRIMARY) throw new Error('SCAN_MODEL_PRIMARY is not set');
  return {
    primary: env.SCAN_MODEL_PRIMARY,
    fallback: env.SCAN_MODEL_FALLBACK || undefined,
    fallbackBelow: Number(env.SCAN_FALLBACK_BELOW ?? '0.9'),
    fallbackEffort: (env.SCAN_FALLBACK_EFFORT as ScanModelConfig['fallbackEffort']) || undefined,
  };
}

export interface ModelRun {
  model: string;
  result: ScanResult;
  usage: Message['usage'];
}

export interface ScanImage {
  data: Buffer;
  contentType: ScanUploadContentType;
}

let client: AnthropicBedrock | undefined;
const getClient = () => (client ??= new AnthropicBedrock({ awsRegion: process.env.AWS_REGION, maxRetries: 2 }));

/** Some Bedrock models/regions may not accept structured outputs; retry once without. */
const isOutputConfigRejected = (err: unknown) =>
  (err as { status?: number })?.status === 400 && /output_config|format|schema/i.test(String((err as Error)?.message));

export async function runModel(
  model: string,
  image: ScanImage,
  localDate: string,
  opts: { effort?: ScanModelConfig['fallbackEffort']; timeoutMs?: number } = {}
): Promise<ModelRun> {
  const { effort, timeoutMs } = opts;
  const requestOptions = timeoutMs ? { timeout: timeoutMs, maxRetries: 0 } : undefined;
  const base: MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 8000,
    system: [{ type: 'text', text: SCAN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.contentType, data: image.data.toString('base64') } },
          { type: 'text', text: scanUserText(localDate) },
        ],
      },
    ],
  };

  const structured: MessageCreateParamsNonStreaming = {
    ...base,
    output_config: { format: { type: 'json_schema', schema: SCAN_OUTPUT_SCHEMA }, ...(effort ? { effort } : {}) },
  };

  let message: Message;
  try {
    message = await getClient().messages.create(structured, requestOptions);
  } catch (err) {
    if (!isOutputConfigRejected(err)) throw err;
    console.warn(`Structured output rejected for ${model}; retrying without`, (err as Error).message);
    message = await getClient().messages.create(base, requestOptions);
  }

  if (message.stop_reason === 'refusal') throw new Error(`Model refused (${model})`);
  if (message.stop_reason === 'max_tokens') throw new Error(`Model output truncated (${model})`);

  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return { model, result: parseScanResult(text), usage: message.usage };
}

/** Whole-request AI budget: HTTP API cuts the request at 30s. */
const DEFAULT_BUDGET_MS = 26_000;
/** Don't start a fallback with less time than this left. */
const MIN_FALLBACK_MS = 12_000;

/** Primary first; fallback when unreadable or low confidence. Returns every run (for logging/evals). */
export async function scanPage(
  image: ScanImage,
  localDate: string,
  cfg = modelConfigFromEnv(),
  budgetMs = DEFAULT_BUDGET_MS
) {
  const deadline = Date.now() + budgetMs;
  const runs: ModelRun[] = [];
  const primary = await runModel(cfg.primary, image, localDate, { timeoutMs: budgetMs });
  runs.push(primary);

  // Self-reported confidence alone misses whole-page date misreads (eval 2026-10-08), so also
  // fall back when events land outside the page's own printed date range.
  const needsFallback =
    !primary.result.readable || primary.result.confidence < cfg.fallbackBelow || !datesConsistent(primary.result);
  const timeLeft = deadline - Date.now();
  if (!needsFallback || !cfg.fallback || cfg.fallback === cfg.primary || timeLeft < MIN_FALLBACK_MS) {
    return { final: primary, runs };
  }

  try {
    const fallback = await runModel(cfg.fallback, image, localDate, { effort: cfg.fallbackEffort, timeoutMs: timeLeft });
    runs.push(fallback);
    return { final: fallback, runs };
  } catch (err) {
    console.error('Fallback model failed; using primary result', err);
    return { final: primary, runs };
  }
}
