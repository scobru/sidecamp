import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'

// Native alert/confirm break input focus on Windows Electron; refocus after each.
for (const name of ['alert', 'confirm'] as const) {
  const native = window[name].bind(window) as (m?: string) => any
  ;(window as any)[name] = (msg?: string) => {
    const r = native(msg)
    ;(window as any).electronAPI?.refocus?.()
    return r
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
