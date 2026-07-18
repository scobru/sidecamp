import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'tunecamp-design-system/style.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
