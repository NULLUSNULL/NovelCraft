import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/manrope'
import '@fontsource-variable/jetbrains-mono'
import '@xyflow/react/dist/style.css'
import './styles/globals.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
