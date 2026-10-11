// Starting point: load the fonts and colours, then show the app.
// The fonts are bundled with the app so they work with no signal (D-092).
// Latin letters only, to keep the download small.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './theme.css';
// Phase C: shared page frame, then one stylesheet per group of screens.
import './styles/frame.css';
import './styles/c1-snags.css';
import './styles/c2-workorders.css';
import './styles/c3-deferrals.css';
import './styles/c4-queries.css';
import { AuthProvider } from './lib/auth';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
