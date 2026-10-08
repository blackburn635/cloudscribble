/**
 * DynamoDB document client and helpers (single table, PK/SK).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const TABLE_NAME = process.env.TABLE_NAME!;

export async function getItem(pk: string, sk: string) {
  const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: pk, SK: sk } }));
  return result.Item ?? null;
}

export async function putItem(item: Record<string, unknown>) {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

/** Query by PK with optional SK prefix (begins_with). */
export async function queryByPK(pk: string, skPrefix?: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: skPrefix ? 'PK = :pk AND begins_with(SK, :sk)' : 'PK = :pk',
      ExpressionAttributeValues: skPrefix ? { ':pk': pk, ':sk': skPrefix } : { ':pk': pk },
    })
  );
  return result.Items ?? [];
}

export async function deleteItem(pk: string, sk: string) {
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: pk, SK: sk } }));
}

/** True for DynamoDB conditional-check failures (expected control flow, not errors). */
export function isConditionalCheckFailed(err: unknown): boolean {
  return (err as { name?: string })?.name === 'ConditionalCheckFailedException';
}
