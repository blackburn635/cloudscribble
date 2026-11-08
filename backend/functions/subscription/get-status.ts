/**
 * GET /v1/subscription/status — the app's source of truth for access + scans left.
 * Reads subscription records by prefix (never a point read) and this month's usage.
 */
import { SCAN_MONTHLY_LIMIT, isAccessActive, type SubscriptionStatusResponse } from '@cloudscribble/shared';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getAuthUser, isAdmin } from '../_shared/auth';
import { getItem } from '../_shared/dynamo';
import { error, success } from '../_shared/response';
import { getEffectiveSubscription, inferSource } from '../_shared/subscription';
import { usageMonth } from '../_shared/quota';
import { wrapHandler } from '../_shared/sentry';

async function _handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  try {
    const user = getAuthUser(event);
    const [sub, usage] = await Promise.all([
      getEffectiveSubscription(user.userId),
      getItem(`USER#${user.userId}`, `USAGE#${usageMonth(new Date())}`),
    ]);
    const admin = isAdmin(user);
    const used = Number(usage?.count ?? 0);
    const status = sub?.status ?? 'none';

    const body: SubscriptionStatusResponse = {
      status,
      source: sub ? inferSource(sub) : null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      hasAccess: admin || isAccessActive(status),
      isAdmin: admin,
      scansUsedThisMonth: used,
      scanMonthlyLimit: SCAN_MONTHLY_LIMIT,
      remainingThisMonth: Math.max(0, SCAN_MONTHLY_LIMIT - used),
    };
    return success(body, 200, event);
  } catch (err) {
    return error(err, event);
  }
}

export const handler = wrapHandler(_handler, 'subscription-status');
