/**
 * Monthly scan quota — `USER#<sub>` / `USAGE#<yyyy-mm>`, atomic conditional ADD.
 * Checked (and consumed) before every AI call; refunded only when the failure is ours.
 */

import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SCAN_MONTHLY_LIMIT } from '@cloudscribble/shared';
import { AppError } from './errors';
import { docClient, TABLE_NAME, isConditionalCheckFailed } from './dynamo';

const KEEP_USAGE_DAYS = 400;

export function usageMonth(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/** Consume one scan; returns scans remaining this month. Throws SCAN_QUOTA_EXCEEDED at the cap. */
export async function consumeScan(userId: string, now = new Date()): Promise<number> {
  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: `USAGE#${usageMonth(now)}` },
        UpdateExpression: 'ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)',
        ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit',
        ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':one': 1,
          ':limit': SCAN_MONTHLY_LIMIT,
          ':ttl': Math.floor(now.getTime() / 1000) + KEEP_USAGE_DAYS * 86400,
        },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    const used = Number(result.Attributes?.count ?? SCAN_MONTHLY_LIMIT);
    return Math.max(0, SCAN_MONTHLY_LIMIT - used);
  } catch (err) {
    if (isConditionalCheckFailed(err)) {
      throw new AppError(
        `You've used all ${SCAN_MONTHLY_LIMIT} scans for this month. Your scans reset on the 1st.`,
        429,
        'SCAN_QUOTA_EXCEEDED'
      );
    }
    throw err;
  }
}

/** Give a scan back after a failure on our side (AI/service error). Best-effort. */
export async function refundScan(userId: string, now = new Date()): Promise<void> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: `USAGE#${usageMonth(now)}` },
        UpdateExpression: 'ADD #count :minus',
        ConditionExpression: '#count > :zero',
        ExpressionAttributeNames: { '#count': 'count' },
        ExpressionAttributeValues: { ':minus': -1, ':zero': 0 },
      })
    );
  } catch (err) {
    console.error('refundScan failed', err);
  }
}
