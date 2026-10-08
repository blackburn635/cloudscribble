import { AppStoreBadge, ButtonLink, Card, IconCard, PageHero, Section, usePageTitle } from '../components/ui';

const STEPS = [
  { icon: '✍️', title: 'Write', text: 'Use your planner, your style, your pens' },
  { icon: '📱', title: 'Capture', text: 'Snap a photo of the page in our app' },
  { icon: '✨', title: 'Convert', text: 'AI turns your handwriting into calendar events' },
  { icon: '🔄', title: 'Share', text: 'Events land in your phone’s calendar — even shared ones' },
];

const FEATURES = [
  { icon: '✨', title: 'Reads Real Handwriting', text: 'Advanced AI reads handwritten dates, times, and appointments — neat or not.' },
  { icon: '📔', title: 'Works With Any Planner', text: 'Weekly, daily, monthly, or a plain notebook. Any brand, any layout.' },
  { icon: '📅', title: 'Your Calendar, Your Choice', text: 'Adds events to any calendar on your iPhone — iCloud, Google, Outlook, or a shared family calendar.' },
  { icon: '✅', title: 'You Stay in Control', text: 'Review and edit every event before it’s saved. Nothing reaches your calendar without your OK.' },
];

export default function Home() {
  usePageTitle('');
  return (
    <>
      <PageHero
        title={<>Your Beautiful Paper Planner,<br className="hidden sm:block" /> Now Digitally Connected</>}
        subtitle="Keep using the planner you love — the one filled with your personal touches and creative style. CloudScribble reads your handwritten plans and adds them to the calendar on your phone."
      >
        <ButtonLink to="/how-it-works">See How It Works</ButtonLink>
        <ButtonLink to="/faq" variant="light">Questions? Read the FAQ</ButtonLink>
      </PageHero>

      <Section className="-mt-10 sm:-mt-14">
        <Card className="px-4 py-10 sm:px-10">
          <h2 className="text-center text-3xl font-semibold sm:text-4xl">How CloudScribble Works</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.title} className="rounded-2xl border border-lavender p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cream text-2xl" aria-hidden>{s.icon}</div>
                <h3 className="font-body text-lg font-semibold text-navy">{s.title}</h3>
                <p className="mt-2">{s.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Features That Make Life Easier">
        <div className="grid gap-6 md:grid-cols-2">
          {FEATURES.map((f) => (
            <IconCard key={f.title} icon={f.icon} title={f.title}>{f.text}</IconCard>
          ))}
        </div>
      </Section>

      <Section>
        <Card className="bg-gradient-to-br from-lavender to-white text-center">
          <h2 className="text-3xl font-semibold">Coming Soon to iPhone</h2>
          <p className="mx-auto mt-3 max-w-xl">
            Bought a CloudScribble planner? It includes a code for a free year of the app.
          </p>
          <div className="mt-6 flex justify-center">
            <AppStoreBadge />
          </div>
        </Card>
      </Section>
    </>
  );
}
