/**
 * POST /v1/webhooks/revenuecat — keeps USER#<sub> / SUBSCRIPTION#IAP in sync with RevenueCat.
 * Public route; verified by a shared secret in the Authorization header (REVENUECAT_WEBHOOK_SECRET).
 *
 * - App User ID = Cognito sub (the app calls Purchases.logIn(sub)).
 * - Writes are ordered by event_timestamp_ms: an older event never overwrites a newer one.
 * - SANDBOX events are ignored in prod (TestFlight purchases can't grant production access).
 * - Events for deleted accounts are ignored (deleting the account doesn't cancel the Apple subscription,
 *   so renewals keep arriving and would otherwise recreate an orphaned record).
 * - Unexpected errors return 500 so RevenueCat retries; skips/bad input return 200.
 */
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { docClient, TABLE_NAME, isConditionalCheckFailed } from '../_shared/dynamo';
import { getSecret } from '../_shared/secrets';
import { authMatches, deriveStatus, HANDLED_EVENT_TYPES, mapSource, toIso, type RevenueCatEvent } from './revenuecat';
import { captureError, wrapHandler } from '../_shared/sentry';

const ok = (body: string): APIGatewayProxyResultV2 => ({ statusCode: 200, body });
const cognito = new CognitoIdentityProviderClient({});

async function userExists(sub: string): Promise<boolean> {
  const res = await cognito.send(
    new ListUsersCommand({ UserPoolId: process.env.USER_POOL_ID!, Filter: `sub = "${sub}"`, Limit: 1 })
  );
  return (res.Users?.length ?? 0) > 0;
}

async function _handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    let secret: string;
    try {
      secret = await getSecret('REVENUECAT_WEBHOOK_SECRET');
    } catch {
      console.error('REVENUECAT_WEBHOOK_SECRET not configured');
      return { statusCode: 500, body: 'Not configured' };
    }
    if (!authMatches(event.headers?.authorization, secret)) {
      console.warn('RevenueCat webhook: bad auth', { ip: event.requestContext?.http?.sourceIp });
      return { statusCode: 401, body: 'Unauthorized' };
    }

    const rc: RevenueCatEvent = JSON.parse(event.body || '{}').event || {};
    const type = rc.type;
    if (!type || !HANDLED_EVENT_TYPES.has(type)) return ok(`skipped: ${type ?? 'no type'}`);
    if (process.env.STAGE === 'prod' && rc.environment === 'SANDBOX') return ok('skipped: sandbox in prod');

    const userId = rc.app_user_id;
    if (!userId || userId.startsWith('$RCAnonymousID:')) {
      console.error('RevenueCat webhook: unmappable app_user_id', userId);
      return ok('skipped: anonymous user');
    }
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      console.error('RevenueCat webhook: app_user_id is not a Cognito sub', userId);
      return ok('skipped: unknown user id format');
    }
    const source = mapSource(rc.store);
    if (!source) return ok(`skipped: store ${rc.store}`);
    if (!(await userExists(userId))) {
      console.log(JSON.stringify({ msg: 'iap event for deleted user', user: userId, type }));
      return ok('skipped: user deleted');
    }

    const now = Date.now();
    const eventMs = rc.event_timestamp_ms ?? now;
    const status = deriveStatus(type, rc.period_type, rc.expiration_at_ms, now);
    const isTrial = status === 'in_trial';

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `USER#${userId}`,
            SK: 'SUBSCRIPTION#IAP',
            subscriptionSource: source,
            status,
            productId: rc.product_id,
            periodType: rc.period_type,
            store: source === 'apple_iap' ? 'app_store' : 'play_store',
            environment: rc.environment,
            originalTransactionId: rc.original_transaction_id,
            offerCode: rc.offer_code ?? undefined,
            currentPeriodStart: toIso(rc.purchased_at_ms),
            currentPeriodEnd: toIso(rc.expiration_at_ms),
            trialEndsAt: isTrial ? toIso(rc.expiration_at_ms) : undefined,
            lastEventType: type,
            lastEventMs: eventMs,
            updatedAt: new Date(now).toISOString(),
            // Expired records clean themselves up after 90 days.
            ...(status === 'expired' && { ttl: Math.floor(now / 1000) + 90 * 86400 }),
          },
          ConditionExpression: 'attribute_not_exists(lastEventMs) OR lastEventMs <= :ts',
          ExpressionAttributeValues: { ':ts': eventMs },
        })
      );
    } catch (err) {
      if (isConditionalCheckFailed(err)) return ok('skipped: older than stored event');
      throw err;
    }

    console.log(JSON.stringify({ msg: 'iap subscription', user: userId, type, status, env: rc.environment }));
    return ok('OK');
  } catch (err) {
    console.error('RevenueCat webhook error', err);
    captureError(err);
    return { statusCode: 500, body: 'Internal error' };
  }
}

export const handler = wrapHandler(_handler, 'revenuecat-webhook');
