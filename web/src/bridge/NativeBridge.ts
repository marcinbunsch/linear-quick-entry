import type { NativeErrorCode, NativeEventName, NativeEvents, NativeMethodName, NativeMethods } from './protocol'

export interface NativeBridge {
  call<Method extends NativeMethodName>(
    method: Method,
    params: NativeMethods[Method]['params'],
  ): Promise<NativeMethods[Method]['result']>
  on<Event extends NativeEventName>(event: Event, listener: (payload: NativeEvents[Event]) => void): () => void
}

export class NativeError extends Error {
  readonly code: NativeErrorCode

  constructor(code: NativeErrorCode, message: string) {
    super(message)
    this.name = 'NativeError'
    this.code = code
  }
}

/** The `native` message handler the Swift shell installs; its replies are encoded from the same protocol shapes. */
type WebKitMessageHandler = {
  postMessage<Method extends NativeMethodName>(body: {
    method: Method
    params: NativeMethods[Method]['params']
  }): Promise<NativeMethods[Method]['result']>
}

declare global {
  interface Window {
    webkit?: { messageHandlers?: { native?: WebKitMessageHandler } }
    /** Entry point the Swift side calls via evaluateJavaScript to push events. */
    __lqeNativeEvent?: <Event extends NativeEventName>(name: Event, payload: NativeEvents[Event]) => void
  }
}

/** Talks to the Swift shell through the `native` WKScriptMessageHandlerWithReply. */
export class WebKitNativeBridge implements NativeBridge {
  private readonly _handler: WebKitMessageHandler
  private readonly _listeners: NativeEventListeners = {
    'panel.shown': new Set(),
    'files.dragOver': new Set(),
    'files.dragExit': new Set(),
    'files.dropped': new Set(),
    'upload.progress': new Set(),
    'settings.changed': new Set(),
    'apiKey.changed': new Set(),
  }

  constructor(handler: WebKitMessageHandler) {
    this._handler = handler
    window.__lqeNativeEvent = (name, payload) => {
      for (const listener of this._listeners[name]) listener(payload)
    }
  }

  async call<Method extends NativeMethodName>(
    method: Method,
    params: NativeMethods[Method]['params'],
  ): Promise<NativeMethods[Method]['result']> {
    try {
      return await this._handler.postMessage({ method, params })
    } catch (error) {
      throw parseNativeError(error)
    }
  }

  on<Event extends NativeEventName>(event: Event, listener: (payload: NativeEvents[Event]) => void): () => void {
    this._listeners[event].add(listener)
    return () => {
      this._listeners[event].delete(listener)
    }
  }
}

type NativeEventListeners = { [Event in NativeEventName]: Set<(payload: NativeEvents[Event]) => void> }

const NATIVE_ERROR_CODES: readonly NativeErrorCode[] = [
  'missingApiKey',
  'network',
  'http',
  'invalidParams',
  'fileUnavailable',
  'cancelled',
  'internal',
]

/** WebKit rejects the reply promise with an Error whose message is the string Swift returned: "<code>: <message>". */
export function parseNativeError(error: unknown): NativeError {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const separatorIndex = rawMessage.indexOf(': ')
  if (separatorIndex === -1) return new NativeError('internal', rawMessage)
  const code = rawMessage.slice(0, separatorIndex)
  const message = rawMessage.slice(separatorIndex + 2)
  const knownCode = NATIVE_ERROR_CODES.find((candidate) => candidate === code)
  if (!knownCode) return new NativeError('internal', rawMessage)
  return new NativeError(knownCode, message)
}
