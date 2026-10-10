import type { Config } from 'tailwindcss';
// Source import (not the package) — this file runs in Node at build time.
import { BRAND } from '../packages/shared/src/constants/branding';

const c = BRAND.colors;

export default {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: c.navy, light: c.navyLight, dark: c.navyDark },
        'brand-blue': c.brandBlue,
        'light-blue': c.lightBlue,
        purple: { DEFAULT: c.lightPurple, dark: c.brandAccent2 },
        mauve: { DEFAULT: c.mauve, light: c.mauveLight },
        rose: { DEFAULT: c.dustyRose, light: c.roseLight },
        sage: { DEFAULT: c.sage, light: c.sageLight },
        gold: { DEFAULT: c.gold, light: c.goldLight, pale: c.paleGold },
        lavender: c.lavender,
        peach: c.softPeach,
        cream: c.cream,
        surface: c.surface,
        'warm-gray': c.warmGray,
      },
    },
  },
  plugins: [],
} satisfies Config;
