import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './grooveflix.css'
import App from './App.jsx'
import { I18nProvider } from './contexts/I18nContext.jsx'
import { SubscriptionProvider } from './contexts/SubscriptionContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <SubscriptionProvider>
        <App />
      </SubscriptionProvider>
    </I18nProvider>
  </StrictMode>,
)
