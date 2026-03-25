import * as Sentry from '@sentry/react';
import { browserTracingIntegration, replayIntegration } from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  
  integrations: [
    browserTracingIntegration(),
    replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  
  environment: import.meta.env.MODE,
  
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  
  replaysSessionSampleRate: import.meta.env.PROD ? 0.05 : 0.5,
  replaysOnErrorSampleRate: 1.0,
  
  beforeSend(event, hint) {
    if (import.meta.env.DEV) {
      return null;
    }
    
    const error = hint?.originalException;
    if (error?.name === 'ChunkLoadError') {
      event.fingerprint = ['chunk-load-error'];
    }
    
    if (error?.message?.includes('Failed to fetch')) {
      event.fingerprint = ['network-error'];
    }
    
    return event;
  },
  
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error exception raised',
    'Network Error',
  ],
  
  denyUrls: [
    /extensions\//i,
    /webapi\./i,
  ],
  
  attachStacktrace: true,
  sendDefaultPii: false,
  
  autoSessionTracking: true,
  
  initialScope: {
    tags: {
      version: import.meta.env.VITE_APP_VERSION || 'unknown',
    },
  },
});

export const SentryMetrics = {
  increment: (name, tags = {}) => {
    Sentry.addBreadcrumb({
      category: 'metric',
      message: name,
      data: tags,
    });
  },
  
  gauge: (name, value, tags = {}) => {
    Sentry.addBreadcrumb({
      category: 'metric',
      message: `${name}: ${value}`,
      data: tags,
    });
  },
};

export const captureAuthError = (error, context) => {
  Sentry.captureException(error, {
    tags: { type: 'auth', context },
    extra: { timestamp: new Date().toISOString() },
  });
};

export const capturePaymentError = (error, transactionId) => {
  Sentry.captureException(error, {
    tags: { type: 'payment', transaction_id: transactionId },
    extra: { timestamp: new Date().toISOString() },
  });
};

export const captureDisputeError = (error, disputeId) => {
  Sentry.captureException(error, {
    tags: { type: 'dispute', dispute_id: disputeId },
    extra: { timestamp: new Date().toISOString() },
  });
};

export default Sentry;
