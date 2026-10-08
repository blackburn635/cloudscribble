/**
 * Subscription resolution — one source of truth for "does this user have access".
 *
 * Records live under PK `USER#<sub>` with SK prefix `SUBSCRIPTION` (SUBSCRIPTION#IAP,
 * SUBSCRIPTION#PLANNER). Always load by prefix — never point-read one record.
 */

import { isAccessActive, type SubscriptionStatus, type SubscriptionSource } from '@cloudscribble/shared';
import { queryByPK } from './dynamo';
import { isAdmin, type AuthUser } from './auth';

export interface SubRecord {
  SK: string;
  status: SubscriptionStatus;
  subscriptionSource?: SubscriptionSource;
  currentPeriodEnd?: string;
}

export function inferSource(record: SubRecord): SubscriptionSource {
  if (record.subscriptionSource) return record.subscriptionSource;
  return record.SK === 'SUBSCRIPTION#PLANNER' ? 'planner' : 'apple_iap';
}

/** Precedence — higher wins. Apple > Google > planner grant. */
export function sourcePriority(source: SubscriptionSource): number {
  if (source === 'apple_iap') return 3;
  if (source === 'google_iap') return 2;
  return 1;
}

/**
 * Pick the effective record: highest-priority among access-active records, else
 * highest-priority among all (so callers still see a representative terminal status).
 */
export function resolveEffectiveSubscription(records: SubRecord[]): SubRecord | null {
  if (records.length === 0) return null;
  const active = records.filter((r) => isAccessActive(r.status));
  const pool = active.length > 0 ? active : records;
  return pool.reduce((best, cur) =>
    sourcePriority(inferSource(cur)) > sourcePriority(inferSource(best)) ? cur : best
  );
}

export async function getEffectiveSubscription(userId: string): Promise<SubRecord | null> {
  const records = (await queryByPK(`USER#${userId}`, 'SUBSCRIPTION')) as unknown as SubRecord[];
  return resolveEffectiveSubscription(records);
}

/** Admins bypass the subscription check (not the quota) for testing and support. */
export async function hasScanAccess(user: AuthUser): Promise<boolean> {
  if (isAdmin(user)) return true;
  const sub = await getEffectiveSubscription(user.userId);
  return !!sub && isAccessActive(sub.status);
}
