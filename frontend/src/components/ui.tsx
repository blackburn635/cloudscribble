import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — CloudScribble` : 'CloudScribble — Your paper planner, digitally connected';
  }, [title]);
}

export function PageHero({
  title,
  subtitle,
  variant = 'mauve',
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  variant?: 'mauve' | 'navy';
  children?: ReactNode;
}) {
  const bg =
    variant === 'mauve'
      ? 'bg-gradient-to-br from-mauve to-mauve-light'
      : 'bg-navy bg-[radial-gradient(circle,rgba(255,255,255,0.12)_1.5px,transparent_1.5px)] [background-size:28px_28px]';
  return (
    <section className={`${bg} rounded-b-[2rem] px-4 py-16 text-center text-white sm:py-24`}>
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl font-semibold leading-tight text-white sm:text-6xl">{title}</h1>
        {subtitle && <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl">{subtitle}</p>}
        {children && <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">{children}</div>}
      </div>
    </section>
  );
}

export function Section({ title, intro, children, className = '' }: { title?: string; intro?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mx-auto max-w-6xl px-4 py-14 sm:px-6 ${className}`}>
      {title && <h2 className="text-center text-3xl font-semibold sm:text-4xl">{title}</h2>}
      {intro && <p className="mx-auto mt-4 max-w-2xl text-center text-lg">{intro}</p>}
      <div className={title || intro ? 'mt-10' : ''}>{children}</div>
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-8 ${className}`}>{children}</div>;
}

export function IconCard({ icon, title, children, tint = 'bg-cream' }: { icon: string; title: string; children: ReactNode; tint?: string }) {
  return (
    <Card className="flex h-full flex-col items-center text-center">
      <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full text-2xl ${tint}`} aria-hidden>
        {icon}
      </div>
      <h3 className="font-body text-xl font-semibold text-navy">{title}</h3>
      <p className="mt-3 leading-relaxed">{children}</p>
    </Card>
  );
}

const buttonBase =
  'inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export function ButtonLink({ to, children, variant = 'primary' }: { to: string; children: ReactNode; variant?: 'primary' | 'mauve' | 'light' }) {
  const styles = {
    primary: 'bg-purple text-white shadow-md hover:bg-purple-dark focus-visible:ring-purple',
    mauve: 'bg-mauve text-white shadow-md hover:bg-mauve/90 focus-visible:ring-mauve',
    light: 'bg-white text-navy shadow-md hover:bg-lavender focus-visible:ring-white',
  }[variant];
  return (
    <Link to={to} className={`${buttonBase} ${styles}`}>
      {children}
    </Link>
  );
}

/** Pre-launch App Store badge. Swap `href` in once the listing is live. */
export function AppStoreBadge({ href, className = '' }: { href?: string; className?: string }) {
  const inner = (
    <>
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
        <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.65.8-3.34.8-.7 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5ZM14.2 6.13c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.55 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.97-.49 2.57-1.23Z" />
      </svg>
      <span className="text-left leading-tight">
        <span className="block text-[0.65rem] uppercase tracking-wide opacity-80">{href ? 'Download on the' : 'Coming soon to the'}</span>
        <span className="block text-base font-semibold">App Store</span>
      </span>
    </>
  );
  const cls = `inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-white shadow-md ${className}`;
  return href ? (
    <a href={href} className={cls}>{inner}</a>
  ) : (
    <span className={`${cls} cursor-default`} aria-label="Coming soon to the App Store">{inner}</span>
  );
}
