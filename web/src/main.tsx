import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { logToNative } from './bridge/logToNative'
import { WebKitNativeBridge } from './bridge/NativeBridge'
import { AppController } from './state/AppController'
import './styles.css'

const rootElement = document.getElementById('root')
const nativeHandler = window.webkit?.messageHandlers?.native
// Fail fast: the panel only works inside the native shell, which installs the `native` message handler.
if (!rootElement) throw new Error('Missing #root element')
if (!nativeHandler) throw new Error('Not running inside Linear Quick Entry: the native bridge is missing')

const bridge = new WebKitNativeBridge(nativeHandler)
const app = new AppController(bridge)
createRoot(rootElement).render(
  <StrictMode>
    <App app={app} />
  </StrictMode>,
)
app.start().catch((error: unknown) => {
  void logToNative(bridge, 'error', 'panel failed to start', { error: String(error) })
})
