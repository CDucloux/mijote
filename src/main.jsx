import React from 'react'
import './styles/global.css'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { installGlobalErrorHandlers } from './lib/observability/observability.js'
import { markNativeFeel } from './lib/ui/nativeFeel.js'
import { registerSW } from 'virtual:pwa-register'

// Filets globaux : erreurs non catchées + rejets de promesse non gérés. La
// destination (Sentry) se branche via initObservability (voir observability.ts).
installGlobalErrorHandlers()

// Feel « app native » (pas de sélection de texte / callout) : posé sur <html> avant
// le rendu, dans la coquille Capacitor comme en PWA installée. Le WebView Capacitor
// ne rapporte pas `display-mode: standalone`, d'où la détection combinée ici.
markNativeFeel(
  document.documentElement,
  Capacitor.isNativePlatform(),
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true,
)

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>
)
