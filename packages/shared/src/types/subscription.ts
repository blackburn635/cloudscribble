/**
 * Subscription types.
 *
 * Records live under PK `USER#<sub>` with SK prefix `SUBSCRIPTION`:
 *   - SUBSCRIPTION#IAP      RevenueCat webhook (App Store; Google Play later)
 *   - SUBSCRIPTION#PLANNER  optional grant for website planner purchases (open decision)
 * Always load by prefix and resolve with isAccessActive() — never point-read one record.
 */

export type SubscriptionStatus =
  | 'in_trial'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'none';

export type SubscriptionSource = 'apple_iap' | 'google_iap' | 'planner';

/** The single definition of "has access" — used by status, quota, and the scan Lambda. */
export function isAccessActive(status: SubscriptionStatus): boolean {
  return status === 'in_trial' || status === 'active' || status === 'past_due';
}

/** RevenueCat entitlement — permanent, never rename (CLAUDE.md). */
export const ENTITLEMENT_ID = 'cloudscribble_access';

/** GET /v1/subscription/status */
export interface SubscriptionStatusResponse {
  status: SubscriptionStatus;
  source: SubscriptionSource | null;
  currentPeriodEnd: string | null;
  /** True when the user may scan (active/trial/past_due, or admin). */
  hasAccess: boolean;
  isAdmin: boolean;
  scansUsedThisMonth: number;
  scanMonthlyLimit: number;
  remainingThisMonth: number;
}
