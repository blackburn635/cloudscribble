/**
 * Lazy profile creation — `USER#<sub>` / `PROFILE` is created on the first API call
 * (no Cognito post-confirmation Lambda).
 */

import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, isConditionalCheckFailed } from './dynamo';
import type { AuthUser } from './auth';

export async function ensureProfile(user: AuthUser, now = new Date()): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { PK: `USER#${user.userId}`, SK: 'PROFILE', email: user.email, createdAt: now.toISOString() },
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
  } catch (err) {
    if (!isConditionalCheckFailed(err)) throw err;
  }
}
