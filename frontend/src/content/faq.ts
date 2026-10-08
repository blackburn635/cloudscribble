import { BRAND, SCAN_MONTHLY_LIMIT } from '@cloudscribble/shared';

export interface FaqItem {
  q: string;
  a: string;
}
export interface FaqCategory {
  id: string;
  name: string;
  items: FaqItem[];
}

/** Keep answers true to how the app actually works (see CLAUDE.md). */
export const FAQ: FaqCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    items: [
      {
        q: 'What is CloudScribble?',
        a: 'CloudScribble is an iPhone app that turns your handwritten planner pages into calendar events. Take a photo of a page, review the events it finds, and add them to the calendar on your phone.',
      },
      {
        q: 'Do I need a CloudScribble planner to use the app?',
        a: 'No. CloudScribble works with any paper planner or notebook — weekly, daily, or monthly, any brand. CloudScribble planners simply include a code for a free year of the app.',
      },
      {
        q: 'How do I get started?',
        a: 'Download CloudScribble from the App Store, create an account, start your subscription (new subscribers get a free trial), allow access to your calendar, and snap a photo of a planner page.',
      },
      {
        q: 'Do I need a subscription?',
        a: 'Yes. CloudScribble is an auto-renewing subscription purchased through the App Store. New subscribers get a free trial, and you can cancel anytime in your Apple account settings.',
      },
      {
        q: 'I bought a CloudScribble planner. How do I get my free year?',
        a: 'Your planner includes an App Store offer code. Redeem it in the App Store (or from the CloudScribble app) to get one year free. After the free year, the subscription renews at the standard price unless you cancel before it renews.',
      },
    ],
  },
  {
    id: 'scanning',
    name: 'Scanning',
    items: [
      {
        q: 'How does scanning work?',
        a: 'The app uploads your photo securely, our AI reads the page and finds the dates, times, and entries you wrote, and the events come back to your phone for you to review. Nothing is added to your calendar until you approve it.',
      },
      {
        q: 'What can CloudScribble read?',
        a: 'Handwritten (or typed) entries on planner pages: appointments with times, time ranges like “3:15–4:00”, and all-day items like birthdays. It skips crossed-out entries, to-do lists, and faint writing that shows through from the other side of the page.',
      },
      {
        q: 'How accurate is it?',
        a: 'CloudScribble reads a wide range of handwriting styles well, but handwriting varies a lot. That’s why you always get to review and edit events before they’re saved.',
      },
      {
        q: 'How many pages can I scan?',
        a: `Each subscription includes up to ${SCAN_MONTHLY_LIMIT} scans per month — plenty for everyday planning. Your count resets on the 1st of each month.`,
      },
      {
        q: 'Which phones are supported?',
        a: 'CloudScribble launches on iPhone. Android is on our roadmap.',
      },
    ],
  },
  {
    id: 'billing',
    name: 'Subscription & Billing',
    items: [
      {
        q: 'How do I cancel my subscription?',
        a: 'Subscriptions are managed by Apple. On your iPhone, open Settings, tap your name, then Subscriptions, and choose CloudScribble.',
      },
      {
        q: 'What happens if I cancel?',
        a: 'You keep access until the end of your current billing period. Events already in your calendar stay there — they belong to you.',
      },
      {
        q: 'How do I request a refund?',
        a: 'Because purchases are made through the App Store, refunds are handled by Apple at reportaproblem.apple.com.',
      },
    ],
  },
  {
    id: 'privacy',
    name: 'Privacy & Data',
    items: [
      {
        q: 'Do you keep my planner photos?',
        a: 'No. Each photo is deleted as soon as it has been read, and our storage automatically removes any leftover upload within 24 hours.',
      },
      {
        q: 'Do you store my calendar or events?',
        a: 'No. Events are created by the app directly in your phone’s calendar. Our servers never store your events or your calendar.',
      },
      {
        q: 'Is my handwriting used to train AI?',
        a: 'No. Your photos are processed only to read your page and are not used to train AI models.',
      },
      {
        q: 'Do you sell my personal information?',
        a: 'Never. See our Privacy Policy for exactly what we collect and why.',
      },
      {
        q: 'How do I delete my account?',
        a: 'In the app, go to Settings → Delete Account, or visit cloudscribble.com/account/delete. If you have an App Store subscription, cancel it in your Apple account settings too.',
      },
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    items: [
      {
        q: 'Which calendars can I use?',
        a: 'Any calendar on your iPhone — iCloud, Google, Outlook/Exchange, or others you’ve added in iPhone Settings → Calendar → Accounts.',
      },
      {
        q: 'Can I add events to a shared family calendar?',
        a: 'Yes. Choose the shared calendar when you save, and everyone who shares it will see the events.',
      },
      {
        q: 'Can I keep work and personal events separate?',
        a: 'Yes. Pick which calendar to use each time you save a scan.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting',
    items: [
      {
        q: 'The app isn’t reading my handwriting well. What can I do?',
        a: 'Lay the planner flat in good light, fill the frame with the page, and hold the phone steady. You can always edit an event before saving it.',
      },
      {
        q: 'What if I scan the same page twice?',
        a: 'CloudScribble remembers the events it added from a page, so scanning it again updates those events instead of creating duplicates.',
      },
      {
        q: 'How do I contact support?',
        a: `Use our Support page or email ${BRAND.supportEmail}. We usually reply within one to two business days.`,
      },
    ],
  },
];
