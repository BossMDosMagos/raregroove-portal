import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './grooveflix.css'
import App from './App.jsx'
import { I18nProvider } from './contexts/I18nContext.jsx'
import { SubscriptionProvider } from './contexts/SubscriptionContext.jsx'
import { AudioPlayerProvider } from './contexts/AudioPlayerContext.jsx'

if (import.meta.env.VITE_SENTRY_DSN) {
  import('./sentry.js').then(({ default: Sentry }) => {
    console.log('[Sentry] Monitoramento ativo');
  });
}

window.addEventListener('error', (event) => {
  if (import.meta.env.VITE_SENTRY_DSN && !event.message?.includes('ResizeObserver')) {
    import('./sentry.js').then(({ captureAuthError }) => {
      console.error('Global error:', event.error);
    });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    import('./sentry.js').then(({ default: Sentry }) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <SubscriptionProvider>
        <AudioPlayerProvider>
          <App />
        </AudioPlayerProvider>
      </SubscriptionProvider>
    </I18nProvider>
  </StrictMode>,
)
