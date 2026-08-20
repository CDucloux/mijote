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

// Marqueur plateforme : coquille Capacitor (Android natif) UNIQUEMENT, distinct du
// feel natif ci-dessus (qui couvre aussi la PWA standalone). L'app native possède
// toute la hauteur de l'écran → la tab bar peut descendre au ras du bas (cf. la
// variable --tab-pad-b dans global.css), ce que la PWA ne permet pas proprement.
document.documentElement.classList.toggle('is-capacitor', Capacitor.isNativePlatform())

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

// Splash d'ouverture (logo + onde, cf. index.html) : retiré une fois l'app montée,
// après un court temps de visibilité pour que l'animation soit perçue. Le fond du
// splash rejoint celui de la page de chargement, la transition est donc continue.
requestAnimationFrame(() => setTimeout(() => window.__hideBootSplash?.(), 550))
