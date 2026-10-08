import { Link } from 'react-router';
import { BRAND, SCAN_MONTHLY_LIMIT } from '@cloudscribble/shared';
import { Card, PageHero, Section, usePageTitle } from '../components/ui';

const LAST_UPDATED = 'October 8, 2026';
const email = BRAND.supportEmail;

export default function Privacy() {
  usePageTitle('Privacy Policy');
  return (
    <>
      <PageHero title="Privacy Policy" subtitle={`Last updated ${LAST_UPDATED}`} />
      <Section>
        <Card className="prose-legal mx-auto max-w-3xl">
          <p>
            {BRAND.company} (“CloudScribble,” “we,” “us”) makes the CloudScribble app and website. This policy explains what
            information we collect, how we use it, and the choices you have. We built CloudScribble to collect as little as
            possible: we never keep your planner photos, and we never store your calendar or events.
          </p>

          <h2>Summary</h2>
          <ul>
            <li>Your planner photo is sent to our servers only to be read, and is deleted right after — within 24 hours at most.</li>
            <li>Events are created by the app directly in your phone’s calendar. We don’t store your events or calendar.</li>
            <li>We keep your account email, your subscription status, and a monthly count of your scans.</li>
            <li>We don’t sell your personal information, and your photos aren’t used to train AI models.</li>
            <li>You can delete your account anytime in the app or <Link to="/account/delete">on our website</Link>.</li>
          </ul>

          <h2>Information we collect</h2>
          <h3>Account information</h3>
          <p>When you create an account we collect your email address and password (stored securely by our sign-in provider, never in plain text), and optionally your first and last name.</p>

          <h3>Planner photos</h3>
          <p>
            When you scan a page, the app uploads that photo so our AI service can read the dates, times, and entries on it.
            The photo is deleted as soon as it has been processed; any upload that isn’t processed is automatically deleted
            within 24 hours. Photos may incidentally contain other information written on the page — please avoid scanning
            pages with sensitive information you don’t want processed.
          </p>

          <h3>Calendar</h3>
          <p>
            With your permission, the app reads and writes your phone’s calendar <em>on your device</em> so it can add the events
            you approve, avoid duplicates, and update events it previously added. Your calendar data is not sent to our servers.
          </p>

          <h3>Usage and subscription information</h3>
          <ul>
            <li>A count of scans per month, used to apply the fair-use limit of {SCAN_MONTHLY_LIMIT} scans per month.</li>
            <li>Your subscription status (for example, active or expired) and the product you subscribed to. Payments are processed by Apple; we never receive your card details.</li>
            <li>Basic technical logs (such as request times and errors) used to keep the service running and secure.</li>
          </ul>

          <h3>Website information</h3>
          <p>
            Our website uses Google Analytics to understand how visitors use the site (pages viewed, approximate location
            derived from IP address, device and browser type). Google Analytics uses cookies. You can opt out with the{' '}
            <a href="https://tools.google.com/dlpage/gaoptout">Google Analytics opt-out browser add-on</a>.
          </p>

          <h3>Messages you send us</h3>
          <p>If you contact support, we receive your name, email address, and message so we can respond.</p>

          <h2>How we use information</h2>
          <ul>
            <li>To provide the service: sign you in, read your planner pages, and return events to your device.</li>
            <li>To manage your subscription and apply usage limits.</li>
            <li>To respond to support requests and send essential service messages (such as account verification codes).</li>
            <li>To keep CloudScribble secure, prevent abuse, and fix problems.</li>
            <li>To understand and improve our website.</li>
          </ul>
          <p>We do not use your information for advertising, and we do not sell or “share” personal information for targeted advertising.</p>

          <h2>Who we share information with</h2>
          <p>We share information only with service providers that help us run CloudScribble, under contracts that limit their use of it:</p>
          <ul>
            <li><strong>Amazon Web Services</strong> — hosting, storage, sign-in, email delivery, and the AI service that reads your pages (Anthropic’s Claude models, provided through Amazon Bedrock). Photos are processed only to read your page and are not used to train AI models.</li>
            <li><strong>Apple</strong> — App Store purchases and subscriptions.</li>
            <li><strong>RevenueCat</strong> — subscription status management.</li>
            <li><strong>Google</strong> — website analytics.</li>
            <li><strong>Cloudflare</strong> — spam protection on our contact form.</li>
          </ul>
          <p>We may also disclose information if required by law, to protect the rights and safety of our users or others, or as part of a merger or sale of our business (in which case this policy would continue to apply).</p>

          <h2>How long we keep information</h2>
          <ul>
            <li>Planner photos: deleted after processing, and within 24 hours at most.</li>
            <li>Account and subscription information: until you delete your account.</li>
            <li>Monthly scan counts: about 13 months, then deleted automatically.</li>
            <li>Support messages: as long as needed to resolve your request.</li>
          </ul>

          <h2>Your choices and rights</h2>
          <ul>
            <li><strong>Delete your account</strong> in the app (Settings → Delete Account) or <Link to="/account/delete">on our website</Link>. This deletes your account and the information associated with it.</li>
            <li><strong>Calendar and camera access</strong> can be turned off anytime in your iPhone’s Settings.</li>
            <li><strong>Access, correction, deletion, and portability:</strong> depending on where you live (including Texas, California, and other U.S. states), you may have the right to request access to, correction of, deletion of, or a copy of your personal information, and to appeal our decision. Email us at <a href={`mailto:${email}`}>{email}</a>. We will verify your request and respond within the time required by law, and we won’t discriminate against you for exercising your rights.</li>
          </ul>

          <h2>Children</h2>
          <p>CloudScribble is not intended for children under 13, and we do not knowingly collect personal information from them. If you believe a child under 13 has given us information, contact us and we will delete it.</p>

          <h2>Security</h2>
          <p>We use industry-standard safeguards, including encryption in transit and at rest, access controls, and automatic deletion of uploaded photos. No system is perfectly secure, but we work to protect your information.</p>

          <h2>Where information is processed</h2>
          <p>CloudScribble is operated from the United States, and information is processed and stored in the United States.</p>

          <h2>Changes to this policy</h2>
          <p>If we make material changes, we’ll update the date above and, where appropriate, notify you in the app or by email.</p>

          <h2>Contact us</h2>
          <p>{BRAND.company} · <a href={`mailto:${email}`}>{email}</a></p>
        </Card>
      </Section>
    </>
  );
}
