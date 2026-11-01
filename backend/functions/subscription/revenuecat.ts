/**
 * Pure RevenueCat helpers (no AWS) — status derivation + webhook auth compare.
 * Status comes from ground-truth fields (period_type + expiration_at_ms), not the event verb,
 * so duplicate/out-of-order deliveries converge. BILLING_ISSUE is the one explicit override.
 * Payload: { api_version, event: {...} }, timestamps in ms.
 * https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
import * as crypto from 'node:crypto';
import type { SubscriptionSource, SubscriptionStatus } from '@cloudscribble/shared';

export const HANDLED_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'EXPIRATION',
  'SUBSCRIPTION_PAUSED',
  'SUBSCRIPTION_EXTENDED',
]);

export interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  period_type?: string; // NORMAL | TRIAL | INTRO | PROMOTIONAL
  store?: string; // APP_STORE | PLAY_STORE | ...
  environment?: string; // PRODUCTION | SANDBOX
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  original_transaction_id?: string;
  offer_code?: string | null;
}

export function deriveStatus(
  eventType: string,
  periodType: string | undefined,
  expirationMs: number | null | undefined,
  now: number
): SubscriptionStatus {
  if (eventType === 'BILLING_ISSUE') return 'past_due';
  if (!expirationMs || expirationMs <= now) return 'expired';
  if (periodType === 'TRIAL' || periodType === 'INTRO') return 'in_trial';
  return 'active'; // NORMAL, and PROMOTIONAL (e.g. planner offer-code year) are paid-equivalent access
}

export function mapSource(store: string | undefined): SubscriptionSource | null {
  if (store === 'APP_STORE') return 'apple_iap';
  if (store === 'PLAY_STORE') return 'google_iap';
  return null;
}

/** Constant-time compare of the Authorization header to the configured secret. */
export function authMatches(header: string | undefined, expected: string): boolean {
  if (!header || !expected) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(b, b); // keep timing independent of length
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export const toIso = (ms: number | null | undefined) => (typeof ms === 'number' ? new Date(ms).toISOString() : undefined);
