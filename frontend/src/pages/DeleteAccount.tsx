import { useState, type FormEvent } from 'react';
import { AuthenticationDetails, CognitoUser, CognitoUserPool, type ICognitoStorage } from 'amazon-cognito-identity-js';
import { BRAND } from '@cloudscribble/shared';
import { config } from '../config';
import { Card, PageHero, Section, usePageTitle } from '../components/ui';

/** Keep tokens in memory only — nothing is left behind in the browser after this page. */
class MemoryStorage implements ICognitoStorage {
  private data = new Map<string, string>();
  setItem(k: string, v: string) { this.data.set(k, v); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

function signIn(email: string, password: string): Promise<string> {
  const Storage = new MemoryStorage();
  const pool = new CognitoUserPool({ UserPoolId: config.userPoolId!, ClientId: config.userPoolClientId!, Storage });
  const user = new CognitoUser({ Username: email, Pool: pool, Storage });
  return new Promise((resolve, reject) => {
    user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess: (session) => resolve(session.getIdToken().getJwtToken()),
      onFailure: (err) => reject(new Error(err?.code === 'NotAuthorizedException' || err?.code === 'UserNotFoundException'
        ? 'Incorrect email or password.' : err?.message || 'Sign-in failed.')),
      newPasswordRequired: () => reject(new Error('Please finish setting up your password in the app first.')),
    });
  });
}

export default function DeleteAccount() {
  usePageTitle('Delete Account');
  const [step, setStep] = useState<'signin' | 'confirm' | 'done'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const configured = !!(config.apiUrl && config.userPoolId && config.userPoolClientId);
  const input = 'mt-1 w-full rounded-xl border border-lavender bg-white px-4 py-3 focus:border-purple focus:outline-none';

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setToken(await signIn(email.trim(), password));
      setPassword('');
      setStep('confirm');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${config.apiUrl}/v1/users/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'We couldn’t delete your account. Please try again or contact support.');
      }
      setToken('');
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHero title="Delete Your Account" subtitle="You can also delete your account in the app: Settings → Delete Account." />
      <Section>
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <h2 className="text-2xl font-semibold">What happens when you delete</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Your CloudScribble account and sign-in are removed permanently.</li>
              <li>Your profile and scan history are deleted from our systems.</li>
              <li>Events already in your phone’s calendar stay there — they’re yours.</li>
              <li>
                <strong>Deleting your account does not cancel an App Store subscription.</strong> Cancel it in your{' '}
                <a className="text-purple underline" href="https://apps.apple.com/account/subscriptions">Apple account settings</a>{' '}
                so you aren’t charged again.
              </li>
            </ul>
          </Card>

          <Card>
            {!configured && (
              <p>
                Online deletion isn’t available right now. Email{' '}
                <a className="text-purple underline" href={`mailto:${BRAND.supportEmail}?subject=Delete%20my%20account`}>{BRAND.supportEmail}</a>{' '}
                from your account’s email address and we’ll delete it for you.
              </p>
            )}

            {configured && step === 'signin' && (
              <form onSubmit={onSignIn}>
                <h2 className="text-2xl font-semibold">Sign in to continue</h2>
                <label className="mt-5 block font-semibold text-navy">
                  Email
                  <input required type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </label>
                <label className="mt-4 block font-semibold text-navy">
                  Password
                  <input required type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </label>
                {error && <p className="mt-4 rounded-xl bg-rose/30 p-3 text-sm text-navy" role="alert">{error}</p>}
                <button disabled={busy} className="mt-6 rounded-xl bg-purple px-6 py-3 font-semibold text-white disabled:opacity-60">
                  {busy ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            )}

            {configured && step === 'confirm' && (
              <form onSubmit={onDelete}>
                <h2 className="text-2xl font-semibold">Confirm deletion</h2>
                <p className="mt-3">Signed in as <strong>{email}</strong>. This can’t be undone.</p>
                <label className="mt-5 block font-semibold text-navy">
                  Type DELETE to confirm
                  <input className={input} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
                </label>
                {error && <p className="mt-4 rounded-xl bg-rose/30 p-3 text-sm text-navy" role="alert">{error}</p>}
                <button
                  disabled={busy || confirmText !== 'DELETE'}
                  className="mt-6 rounded-xl bg-red-700 px-6 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {busy ? 'Deleting…' : 'Permanently Delete My Account'}
                </button>
              </form>
            )}

            {step === 'done' && (
              <div className="text-center">
                <h2 className="text-2xl font-semibold">Your account has been deleted</h2>
                <p className="mt-3">
                  Remember to cancel any App Store subscription in your{' '}
                  <a className="text-purple underline" href="https://apps.apple.com/account/subscriptions">Apple account settings</a>.
                </p>
              </div>
            )}
          </Card>
        </div>
      </Section>
    </>
  );
}
