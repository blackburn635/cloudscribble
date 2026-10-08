/**
 * Branding constants — single source for web, mobile (Tailwind/NativeWind), and backend emails.
 * Palette carried over from the archived CloudScribble app (src/constants/Colors.ts).
 * Source artwork lives in docs/brand/.
 */

export const BRAND = {
  /** Working app name — final name is an open decision (see CLAUDE.md) */
  name: 'CloudScribble',

  tagline: 'Your beautiful paper planner, now digitally connected.',

  description:
    'Photograph any paper planner page and CloudScribble adds the events to your phone’s calendar.',

  company: 'CloudScribble LLC',

  domain: 'cloudscribble.com',
  supportEmail: 'support@cloudscribble.com',
  noReplyEmail: 'no-reply@cloudscribble.com',

  fonts: {
    heading: 'Cormorant Garamond',
    body: 'Quicksand',
  },

  colors: {
    // Primary
    navy: '#283593',
    navyLight: '#3949ab',
    navyDark: '#2a3580',
    brandBlue: '#03A9F4',
    lightBlue: '#78CBF9',
    lightPurple: '#6774c8',
    brandAccent2: '#5865bf',

    // Secondary
    mauve: '#B995A9',
    mauveLight: '#C5A7B8',
    dustyRose: '#E8B4BC',
    roseLight: '#F2C4CB',
    sage: '#9CAF88',
    sageLight: '#B5C7A4',
    gold: '#C8A943',
    goldLight: '#D4BC6C',
    paleGold: '#E6D5AC',
    lavender: '#E6E6FA',
    softPeach: '#FFDFD3',

    // Neutrals
    background: '#fcfcfc',
    cream: '#FDF8F0',
    surface: '#ffffff',
    warmGray: '#4A4B4F',
    white: '#ffffff',
    black: '#000000',
  },
} as const;

export type BrandColor = keyof typeof BRAND.colors;
