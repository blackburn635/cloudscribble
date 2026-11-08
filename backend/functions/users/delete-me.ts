import { AdminDeleteUserCommand, CognitoIdentityProviderClient, UserNotFoundException } from '@aws-sdk/client-cognito-identity-provider';
import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getAuthUser } from '../_shared/auth';
import { getSecret } from '../_shared/secrets';
import { docClient, TABLE_NAME } from '../_shared/dynamo';
import { error, noContent } from '../_shared/response';
import { wrapHandler } from '../_shared/sentry';

const cognito = new CognitoIdentityProviderClient({});

/** Delete every item under PK = USER#<sub> (profile, subscriptions, usage). */
async function deleteUserItems(userId: string): Promise<number> {
  const pk = `USER#${userId}`;
  let deleted = 0;
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey: startKey,
      })
    );
    const keys = (page.Items ?? []).map((i) => ({ PK: i.PK, SK: i.SK }));
    for (let i = 0; i < keys.length; i += 25) {
      let requests = keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
      for (let attempt = 0; requests.length && attempt < 5; attempt++) {
        const res = await docClient.send(new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: requests } }));
        requests = (res.UnprocessedItems?.[TABLE_NAME] ?? []) as typeof requests;
        if (requests.length) await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
      }
      if (requests.length) throw new Error('Could not delete all user records');
    }
    deleted += keys.length;
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return deleted;
}

/**
 * Best-effort: delete the RevenueCat customer so it stops sending webhooks for this user.
 * Optional — skipped when REVENUECAT_SECRET_API_KEY isn't configured; never fails the deletion.
 */
async function deleteRevenueCatCustomer(userId: string): Promise<void> {
  let key: string;
  try {
    key = await getSecret('REVENUECAT_SECRET_API_KEY');
  } catch {
    return;
  }
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && res.status !== 404) console.warn('RevenueCat customer delete failed', res.status);
  } catch (err) {
    console.warn('RevenueCat customer delete failed', err);
  }
}

/**
 * DELETE /v1/users/me — permanent account deletion (Apple 5.1.1(v)); always allowed.
 * Data first, then the Cognito user, so a failure can be retried while the user can still sign in.
 * App Store subscriptions are not cancelled by this — the clients tell the user to cancel with Apple.
 */
async function _handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  try {
    const user = getAuthUser(event);
    const username = String(event.requestContext.authorizer.jwt.claims['cognito:username'] ?? user.userId);

    const items = await deleteUserItems(user.userId);
    try {
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: process.env.USER_POOL_ID!, Username: username }));
    } catch (err) {
      if (!(err instanceof UserNotFoundException)) throw err;
    }

    await deleteRevenueCatCustomer(user.userId);

    console.log(JSON.stringify({ msg: 'account deleted', user: user.userId, items }));
    return noContent(event);
  } catch (err) {
    return error(err, event);
  }
}

export const handler = wrapHandler(_handler, 'users-delete-me');
