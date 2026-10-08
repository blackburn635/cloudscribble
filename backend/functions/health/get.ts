import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success } from '../_shared/response';

/** GET /v1/health — public liveness check. */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  return success({ status: 'ok', stage: process.env.STAGE }, 200, event);
}
