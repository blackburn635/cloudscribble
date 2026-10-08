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
