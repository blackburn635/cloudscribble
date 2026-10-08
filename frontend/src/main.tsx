import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { BRAND } from '@cloudscribble/shared';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/quicksand/400.css';
import '@fontsource/quicksand/500.css';
import '@fontsource/quicksand/600.css';
import './styles.css';
import App from './App';
import { initAnalytics } from './analytics';

// Brand palette → CSS variables consumed by the Tailwind theme (styles.css).
for (const [name, value] of Object.entries(BRAND.colors)) {
  document.documentElement.style.setProperty(`--brand-${name}`, value);
}

initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
