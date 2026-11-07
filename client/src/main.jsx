import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Dismiss the boot loader once the app has painted. rAF is preferred, with a
// timeout fallback so the loader can never trap the page (throttled timers,
// hidden tabs, headless renderers).
function dismissBootLoader() {
  const loader = document.getElementById('boot-loader')
  if (!loader) return
  loader.classList.add('boot-loader-done')
  window.setTimeout(() => loader.remove(), 500)
}

requestAnimationFrame(() => requestAnimationFrame(dismissBootLoader))
window.setTimeout(dismissBootLoader, 1200)
