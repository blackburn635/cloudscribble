import { AppStoreBadge, ButtonLink, Card, IconCard, PageHero, Section, usePageTitle } from '../components/ui';

const STEPS = [
  { icon: '✏️', tint: 'bg-rose', title: 'Write Naturally', text: 'Use your favorite planner, your preferred pens, and your personal planning style. No changes to your routine.' },
  { icon: '📱', tint: 'bg-sage', title: 'Capture Instantly', text: 'Open the CloudScribble app and take a photo of your planner page. Weekly spreads, daily pages, and monthly grids all work.' },
  { icon: '✨', tint: 'bg-lavender', title: 'AI Does the Work', text: 'Advanced handwriting recognition reads your entries — dates, times, and all-day plans — and turns them into calendar events.' },
  { icon: '🔄', tint: 'bg-mauve', title: 'Review & Sync', text: 'Check the events, edit anything that needs it, and add them to any calendar on your phone, including shared ones.' },
];

const TIPS = [
  'Lay the planner flat in good, even light.',
  'Fill the frame with the page (or the two-page spread).',
  'Hold the phone steady and parallel to the page.',
  'Crossed-out entries and to-do lists are skipped automatically.',
];

export default function HowItWorks() {
  usePageTitle('How It Works');
  return (
    <>
      <PageHero
        variant="navy"
        title="See How CloudScribble Works"
        subtitle="Watch how easy it is to connect your handwritten planner to your digital world."
      />

      <Section className="-mt-10 sm:-mt-14">
        <Card className="text-center">
          <h2 className="font-body text-2xl font-semibold sm:text-3xl">Your Planner, Instantly Digital</h2>
          <p className="mx-auto mt-3 max-w-2xl">See how CloudScribble bridges the gap between your favorite paper planner and your digital life.</p>
          <video
            className="mx-auto mt-8 w-full max-w-3xl rounded-xl shadow-lg"
            src="/video/how-it-works.mp4"
            controls
            playsInline
            preload="metadata"
          >
            Your browser doesn’t support embedded video.
          </video>
        </Card>
      </Section>

      <Section title="Four Simple Steps">
        <div className="grid gap-6 md:grid-cols-2">
          {STEPS.map((s) => (
            <IconCard key={s.title} icon={s.icon} title={s.title} tint={s.tint}>{s.text}</IconCard>
          ))}
        </div>
      </Section>

      <Section title="Tips for a Great Scan">
        <Card>
          <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {TIPS.map((t) => (
              <li key={t} className="flex gap-3">
                <span className="text-sage" aria-hidden>✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <AppStoreBadge />
          <ButtonLink to="/faq" variant="mauve">Read the FAQ</ButtonLink>
        </div>
      </Section>
    </>
  );
}
