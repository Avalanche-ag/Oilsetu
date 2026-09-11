import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initI18n } from './i18n'
import './index.css'

const storedLang = localStorage.getItem('oilsetu-lang') || 'en'
initI18n(storedLang)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
