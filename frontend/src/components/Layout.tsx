import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { BRAND } from '@cloudscribble/shared';
import { AppStoreBadge } from './ui';

const NAV = [
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/faq', label: 'FAQ' },
  { to: '/support', label: 'Support' },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `border-l-2 border-light-blue px-3 py-1 font-semibold text-navy transition hover:text-purple ${isActive ? 'text-purple' : ''}`;

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="CloudScribble home" onClick={() => setOpen(false)}>
          <img src="/images/logo.png" alt="CloudScribble — Write once. Share everywhere." className="h-14 w-auto sm:h-16" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={linkCls}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block">
          <AppStoreBadge />
        </div>

        <button
          className="rounded-lg p-2 text-navy md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-lavender px-4 pb-5 md:hidden" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="block py-3 text-lg font-semibold text-navy" onClick={() => setOpen(false)}>
              {n.label}
            </NavLink>
          ))}
          <AppStoreBadge className="mt-3" />
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 bg-navy pb-[env(safe-area-inset-bottom,0px)] text-white/85">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-heading text-2xl font-semibold text-white">CloudScribble</p>
          <p className="mt-2 text-sm">Write once. Share everywhere.</p>
        </div>
        <nav className="flex flex-col gap-2 text-sm" aria-label="Footer">
          <Link to="/how-it-works" className="hover:text-white">How It Works</Link>
          <Link to="/faq" className="hover:text-white">FAQ</Link>
          <Link to="/support" className="hover:text-white">Support</Link>
        </nav>
        <nav className="flex flex-col gap-2 text-sm" aria-label="Legal">
          <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white">Terms of Service</Link>
          <Link to="/account/delete" className="hover:text-white">Delete Account</Link>
          <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-white">{BRAND.supportEmail}</a>
        </nav>
      </div>
      <p className="border-t border-white/15 px-4 py-5 text-center text-xs text-white/60">
        © {new Date().getFullYear()} {BRAND.company}. All rights reserved.
      </p>
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
