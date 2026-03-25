import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './grooveflix.css'
import App from './App.jsx'
import { I18nProvider } from './contexts/I18nContext.jsx'
import { SubscriptionProvider } from './contexts/SubscriptionContext.jsx'
import { AudioPlayerProvider } from './contexts/AudioPlayerContext.jsx'
import { DiscogsProvider } from './contexts/DiscogsContext.jsx'

if (import.meta.env.VITE_SENTRY_DSN) {
  import('./sentry.js');
}

window.addEventListener('error', (event) => {
  if (import.meta.env.VITE_SENTRY_DSN && !event.message?.includes('ResizeObserver')) {
    import('./sentry.js').then(({ captureAuthError }) => {
      captureAuthError(event.error);
    }).catch(() => {});
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    import('./sentry.js').then(({ default: Sentry }) => {
      Sentry?.captureException(event.reason);
    }).catch(() => {});
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <SubscriptionProvider>
        <AudioPlayerProvider>
          <DiscogsProvider>
            <App />
          </DiscogsProvider>
        </AudioPlayerProvider>
      </SubscriptionProvider>
    </I18nProvider>
  </StrictMode>,
)
