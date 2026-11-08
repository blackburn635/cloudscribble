import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success } from '../_shared/response';
import { wrapHandler } from '../_shared/sentry';

/** GET /v1/health — public liveness check. */
async function _handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  return success({ status: 'ok', stage: process.env.STAGE }, 200, event);
}

export const handler = wrapHandler(_handler, 'health-get');
