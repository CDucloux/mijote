import React from 'react'
import './styles/global.css'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import App from './App.jsx'
import { PublicApp } from './PublicApp.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { installGlobalErrorHandlers } from './lib/observability/observability.js'
import { markNativeFeel } from './lib/ui/nativeFeel.js'
import { isAppContext, getRuntimeContext } from './lib/ui/runtimeContext.js'
import { isAppZone, toAppPath, APP_BASE } from './lib/ui/appZone.js'
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

// Deux zones d'URL (cf. lib/ui/appZone.ts) : la vitrine PUBLIQUE à la racine (/,
// /legal, /discover) et l'APPLICATION sous /app. On décide au boot, avant de monter
// le routeur. En zone app, on garantit le préfixe /app (Capacitor démarre à la
// racine, une PWA déjà installée sur un ancien start_url /home aussi) : le routeur
// est alors monté avec basename="/app", ce qui retire /app de location.pathname et
// laisse TOUT le code interne de l'app (parsing + navigate) inchangé.
const appZone = isAppZone(window.location.pathname, isAppContext(getRuntimeContext()))
if (appZone) {
    const normalized = toAppPath(window.location.pathname)
    if (normalized !== window.location.pathname) {
        window.history.replaceState(null, '', normalized + window.location.search + window.location.hash)
    }
}

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter basename={appZone ? APP_BASE : undefined}>
                {appZone ? <App /> : <PublicApp />}
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>
)

// Splash d'ouverture (logo + onde, cf. index.html) : retiré une fois l'app montée,
// après un court temps de visibilité pour que l'animation soit perçue. Le fond du
// splash rejoint celui de la page de chargement, la transition est donc continue.
requestAnimationFrame(() => setTimeout(() => window.__hideBootSplash?.(), 550))
