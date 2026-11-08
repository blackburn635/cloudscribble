/**
 * Sentry for Lambda handlers (TableTryb pattern).
 *
 *   async function _handler(event) { ... }
 *   export const handler = wrapHandler(_handler, 'scans-create');
 *
 * DSN comes from Secrets Manager (SENTRY_DSN), loaded once per cold start. Missing DSN → handlers
 * run without Sentry. Handlers catch their own errors, so unexpected ones are reported via
 * `captureError` (called from response.error()); thrown errors are caught by the wrapper.
 * No PII: user = Cognito sub only; request bodies and images are never attached.
 */
import * as Sentry from '@sentry/aws-serverless';
import { getSecret } from './secrets';

let initialized = false;

async function initSentry(): Promise<void> {
  if (initialized) return;
  initialized = true; // never retry per invocation
  try {
    const dsn = await getSecret('SENTRY_DSN');
    const stage = process.env.STAGE || 'staging';
    Sentry.init({ dsn, environment: stage, sendDefaultPii: false, tracesSampleRate: stage === 'prod' ? 0.1 : 1.0 });
  } catch (err) {
    console.warn('Sentry initialization skipped:', (err as Error).message);
  }
}

/** Report an error to Sentry (no-op when Sentry isn't initialized). */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export function wrapHandler<TEvent, TResult>(
  handler: (event: TEvent) => Promise<TResult>,
  functionName: string
): (event: TEvent) => Promise<TResult> {
  return Sentry.wrapHandler(async (event: TEvent) => {
    await initSentry();
    Sentry.setTag('function', functionName);
    const sub = (event as { requestContext?: { authorizer?: { jwt?: { claims?: { sub?: string } } } } }).requestContext
      ?.authorizer?.jwt?.claims?.sub;
    if (sub) Sentry.setUser({ id: sub });
    return handler(event);
  }) as unknown as (event: TEvent) => Promise<TResult>;
}
