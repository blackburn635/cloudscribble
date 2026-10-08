import { Link } from 'react-router';
import { BRAND, SCAN_MONTHLY_LIMIT } from '@cloudscribble/shared';
import { Card, PageHero, Section, usePageTitle } from '../components/ui';

const LAST_UPDATED = 'October 8, 2026';
const email = BRAND.supportEmail;

export default function Terms() {
  usePageTitle('Terms of Service');
  return (
    <>
      <PageHero title="Terms of Service" subtitle={`Last updated ${LAST_UPDATED}`} />
      <Section>
        <Card className="prose-legal mx-auto max-w-3xl">
          <p>
            These Terms of Service (“Terms”) are an agreement between you and {BRAND.company} (“CloudScribble,” “we,” “us”)
            covering the CloudScribble app, website, and related services (the “Service”). By using the Service you agree to
            these Terms and our <Link to="/privacy">Privacy Policy</Link>.
          </p>

          <h2>1. Eligibility and accounts</h2>
          <p>You must be at least 13 years old to use the Service. If you are under 18, you may use the Service only with the involvement of a parent or guardian who agrees to these Terms. You’re responsible for your account and for keeping your password secure.</p>

          <h2>2. The Service</h2>
          <p>CloudScribble reads photos of your paper planner pages and suggests calendar events, which you review before the app adds them to your phone’s calendar. We may update, improve, or change features over time.</p>

          <h2>3. Review before you rely on it</h2>
          <p>
            Handwriting recognition is not perfect. Always review events — including dates, times, and titles — before saving
            them. <strong>You are responsible for the events in your calendar.</strong> CloudScribble is not liable for missed,
            incorrect, or duplicated appointments resulting from how a page was read.
          </p>

          <h2>4. Subscriptions and billing</h2>
          <ul>
            <li>The Service requires a paid, auto-renewing subscription purchased through the Apple App Store. Prices are shown in the app before you buy.</li>
            <li>Your subscription renews automatically at the end of each period unless you cancel at least 24 hours before it renews. Manage or cancel it in your Apple account settings.</li>
            <li>Free trials and offer codes (including codes included with CloudScribble planners) are subject to the terms shown when you redeem them. Unless you cancel, the subscription continues at the standard price when the free period ends.</li>
            <li>Payments and refunds are handled by Apple under its terms. We can’t issue refunds for App Store purchases.</li>
          </ul>

          <h2>5. Fair use</h2>
          <p>Each subscription includes up to {SCAN_MONTHLY_LIMIT} scans per calendar month. We may adjust this limit with notice. Automated, bulk, or abusive use isn’t permitted.</p>

          <h2>6. Acceptable use</h2>
          <p>You agree not to: misuse or interfere with the Service; attempt to access it other than through the app or website; reverse engineer it except where the law permits; upload content you don’t have the right to use or that is unlawful; or use it to infringe others’ rights.</p>

          <h2>7. Your content</h2>
          <p>You own your planner pages and your events. You give us permission to process the photos you submit only to provide the Service, as described in our <Link to="/privacy">Privacy Policy</Link>.</p>

          <h2>8. Our property</h2>
          <p>The Service, including its software, design, and branding, belongs to CloudScribble and its licensors. These Terms give you a personal, non-transferable, revocable license to use the Service for your own planning.</p>

          <h2>9. Ending your use</h2>
          <p>You can stop using the Service and <Link to="/account/delete">delete your account</Link> at any time (cancel your App Store subscription separately). We may suspend or end access if you violate these Terms or to protect the Service or others.</p>

          <h2>10. Disclaimers</h2>
          <p>THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT, TO THE FULLEST EXTENT PERMITTED BY LAW.</p>

          <h2>11. Limitation of liability</h2>
          <p>TO THE FULLEST EXTENT PERMITTED BY LAW, CLOUDSCRIBBLE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, OPPORTUNITIES, OR PROFITS. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE AMOUNT YOU PAID FOR THE SERVICE IN THE 12 MONTHS BEFORE THE CLAIM.</p>

          <h2>12. Indemnity</h2>
          <p>You agree to indemnify CloudScribble against claims arising from your misuse of the Service or violation of these Terms.</p>

          <h2>13. Governing law</h2>
          <p>These Terms are governed by the laws of the State of Texas, without regard to its conflict-of-law rules. Any dispute will be resolved in the state or federal courts located in Texas, and you and we consent to their jurisdiction.</p>

          <h2>14. Apple App Store terms</h2>
          <p>If you downloaded the app from the Apple App Store: these Terms are between you and CloudScribble, not Apple. Apple has no obligation to provide maintenance or support for the app. To the extent any warranty applies and the app fails to conform, you may notify Apple for a refund of the purchase price (if any), and Apple has no other warranty obligation. Apple is not responsible for addressing claims relating to the app, including product liability, legal or regulatory compliance, consumer protection, or intellectual property claims. Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them against you. You represent that you are not located in a country subject to U.S. embargo or listed on any U.S. government prohibited-party list.</p>

          <h2>15. Changes</h2>
          <p>We may update these Terms. If changes are material, we’ll notify you in the app or by email before they take effect. Continuing to use the Service after that means you accept the updated Terms.</p>

          <h2>16. Contact</h2>
          <p>{BRAND.company} · <a href={`mailto:${email}`}>{email}</a></p>
        </Card>
      </Section>
    </>
  );
}
