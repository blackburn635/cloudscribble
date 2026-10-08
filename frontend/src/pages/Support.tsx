import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BRAND } from '@cloudscribble/shared';
import { config } from '../config';
import { Card, PageHero, Section, usePageTitle } from '../components/ui';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const TOPICS = ['General question', 'Billing & subscriptions', 'App technical support', 'Planner offer code', 'Feedback & suggestions'];

/** Cloudflare Turnstile widget; calls onToken with a fresh token (or '' when expired). */
function Turnstile({ siteKey, onToken, resetSignal }: { siteKey: string; onToken: (t: string) => void; resetSignal: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const render = () => {
      if (!ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    };
    if (window.turnstile) return render();
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [siteKey, onToken]);

  useEffect(() => {
    if (resetSignal && widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetSignal]);

  return <div ref={ref} className="mt-2" />;
}

export default function Support() {
  usePageTitle('Support');
  const [form, setForm] = useState({ name: '', email: '', topic: TOPICS[0], message: '', website: '' });
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [resetSignal, setResetSignal] = useState(0);

  const formEnabled = !!config.apiUrl && !!config.turnstileSiteKey;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('Please complete the verification check.');
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const res = await fetch(`${config.apiUrl}/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstileToken: token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Something went wrong.');
      }
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(`${(err as Error).message} You can also email us at ${BRAND.supportEmail}.`);
      setToken('');
      setResetSignal((n) => n + 1);
    }
  }

  const input = 'mt-1 w-full rounded-xl border border-lavender bg-white px-4 py-3 text-warm-gray focus:border-purple focus:outline-none';

  return (
    <>
      <PageHero title="We’re Here to Help" subtitle="Questions about your subscription, the app, or your planner offer code? Send us a message." />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <Card>
            {status === 'sent' ? (
              <div className="py-10 text-center">
                <h2 className="text-3xl font-semibold">Thanks — message sent!</h2>
                <p className="mt-3">We’ll reply to {form.email}, usually within one to two business days.</p>
              </div>
            ) : formEnabled ? (
              <form onSubmit={submit} noValidate={false}>
                <h2 className="text-2xl font-semibold">Send us a message</h2>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className="block font-semibold text-navy">
                    Name
                    <input required maxLength={100} className={input} value={form.name} onChange={set('name')} autoComplete="name" />
                  </label>
                  <label className="block font-semibold text-navy">
                    Email
                    <input required type="email" maxLength={254} className={input} value={form.email} onChange={set('email')} autoComplete="email" />
                  </label>
                </div>
                <label className="mt-5 block font-semibold text-navy">
                  Topic
                  <select className={input} value={form.topic} onChange={set('topic')}>
                    {TOPICS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className="mt-5 block font-semibold text-navy">
                  Message
                  <textarea required minLength={10} maxLength={5000} rows={6} className={input} value={form.message} onChange={set('message')} />
                </label>
                {/* Honeypot: humans never see or fill this. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={set('website')} aria-hidden />
                <Turnstile siteKey={config.turnstileSiteKey!} onToken={setToken} resetSignal={resetSignal} />
                {error && <p className="mt-4 rounded-xl bg-rose/30 p-3 text-sm text-navy" role="alert">{error}</p>}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="mt-6 rounded-xl bg-purple px-6 py-3 font-semibold text-white shadow-md transition hover:bg-purple-dark disabled:opacity-60"
                >
                  {status === 'sending' ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            ) : (
              <div className="py-6">
                <h2 className="text-2xl font-semibold">Email us</h2>
                <p className="mt-3">
                  Write to <a className="font-semibold text-purple underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> and we’ll get back to you.
                </p>
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <h3 className="font-body text-lg font-semibold text-navy">Email</h3>
              <a className="mt-1 block text-purple underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
              <h3 className="mt-5 font-body text-lg font-semibold text-navy">Response time</h3>
              <p className="mt-1">Usually within one to two business days.</p>
            </Card>
            <Card>
              <h3 className="font-body text-lg font-semibold text-navy">Quick help</h3>
              <ul className="mt-2 space-y-2">
                <li><Link to="/faq" className="text-purple underline">Frequently asked questions</Link></li>
                <li><Link to="/account/delete" className="text-purple underline">Delete your account</Link></li>
                <li><a href="https://apps.apple.com/account/subscriptions" className="text-purple underline">Manage your App Store subscription</a></li>
              </ul>
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}
