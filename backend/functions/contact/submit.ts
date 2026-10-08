import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BRAND } from '@cloudscribble/shared';
import { AppError, BadRequestError } from '../_shared/errors';
import { error, parseBody, success } from '../_shared/response';
import { getSecret } from '../_shared/secrets';

const ses = new SESv2Client({});
const TOPICS = new Set(['General question', 'Billing & subscriptions', 'App technical support', 'Planner offer code', 'Feedback & suggestions']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactRequest {
  name?: string;
  email?: string;
  topic?: string;
  message?: string;
  /** Honeypot — real users leave it empty */
  website?: string;
  turnstileToken?: string;
}

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

async function verifyTurnstile(token: string, ip: string | undefined): Promise<boolean> {
  let secret: string;
  try {
    secret = await getSecret('TURNSTILE_SECRET_KEY');
  } catch {
    // Never accept unverified submissions: no secret configured → form unavailable.
    throw new AppError('The contact form is temporarily unavailable. Please email us instead.', 503, 'CONTACT_UNAVAILABLE');
  }
  const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

/** POST /v1/contact — public support form → email to support@ (Reply-To: the sender). */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = parseBody<ContactRequest>(event.body);
    if (body.website) return success({ ok: true }, 200, event); // bot: pretend success

    const name = clean(body.name, 100);
    const email = clean(body.email, 254);
    const topic = clean(body.topic, 60);
    const message = clean(body.message, 5000);
    if (!name || !EMAIL_RE.test(email) || !TOPICS.has(topic) || message.length < 10) {
      throw new BadRequestError('Please fill in your name, a valid email, a topic, and a message.');
    }
    if (!body.turnstileToken || !(await verifyTurnstile(body.turnstileToken, event.requestContext.http.sourceIp))) {
      throw new AppError('Verification failed — please try again.', 400, 'CONTACT_VERIFICATION_FAILED');
    }

    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: `CloudScribble Support Form <${BRAND.noReplyEmail}>`,
        Destination: { ToAddresses: [BRAND.supportEmail] },
        ReplyToAddresses: [email],
        Content: {
          Simple: {
            Subject: { Data: `[Support] ${topic} — ${name}`.slice(0, 200) },
            Body: {
              Text: {
                Data: `From: ${name} <${email}>\nTopic: ${topic}\nStage: ${process.env.STAGE}\n\n${message}\n`,
              },
            },
          },
        },
      })
    );

    return success({ ok: true }, 200, event);
  } catch (err) {
    return error(err, event);
  }
}
