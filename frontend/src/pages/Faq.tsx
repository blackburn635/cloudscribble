import { useState } from 'react';
import { Link } from 'react-router';
import { FAQ } from '../content/faq';
import { PageHero, Section, usePageTitle } from '../components/ui';

export default function Faq() {
  usePageTitle('FAQ');
  const [active, setActive] = useState<string>('all');
  const categories = active === 'all' ? FAQ : FAQ.filter((c) => c.id === active);

  const chip = (id: string, label: string) => (
    <button
      key={id}
      onClick={() => setActive(id)}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active === id ? 'bg-navy text-white' : 'bg-white text-navy shadow-sm hover:bg-lavender'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHero title="Frequently Asked Questions" subtitle="Answers to common questions about CloudScribble." />
      <Section>
        <div className="flex flex-wrap justify-center gap-2">
          {chip('all', 'All Questions')}
          {FAQ.map((c) => chip(c.id, c.name))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-10">
          {categories.map((c) => (
            <div key={c.id}>
              <h2 className="mb-4 text-2xl font-semibold">{c.name}</h2>
              <div className="space-y-3">
                {c.items.map((item) => (
                  <details key={item.q} className="group rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy">
                      {item.q}
                      <span className="text-xl text-purple transition group-open:rotate-45" aria-hidden>+</span>
                    </summary>
                    <p className="mt-3 leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center">
          Still have a question? <Link to="/support" className="font-semibold text-purple underline">Contact support</Link>.
        </p>
      </Section>
    </>
  );
}
