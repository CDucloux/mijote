import React from 'react'
import './styles/global.css'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { installGlobalErrorHandlers } from './lib/observability/observability.js'
import { registerSW } from 'virtual:pwa-register'

// Filets globaux : erreurs non catchées + rejets de promesse non gérés. La
// destination (Sentry) se branche via initObservability (voir observability.ts).
installGlobalErrorHandlers()

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
