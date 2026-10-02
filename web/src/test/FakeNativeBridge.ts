import type { NativeBridge } from '../bridge/NativeBridge'
import type { NativeEventName, NativeEvents, NativeMethodName, NativeMethods } from '../bridge/protocol'

type Handler<Method extends NativeMethodName> = (params: NativeMethods[Method]['params']) => Promise<NativeMethods[Method]['result']>
type Handlers = { [Method in NativeMethodName]?: Handler<Method> }
type Listeners = { [Event in NativeEventName]: Set<(payload: NativeEvents[Event]) => void> }
type RecordedCall = { method: NativeMethodName; params: unknown }

/** Stands in for the Swift shell: tests register replies per method and push events by hand. */
export class FakeNativeBridge implements NativeBridge {
  readonly calls: RecordedCall[] = []
  readonly storage = new Map<string, string>()

  private readonly _handlers: Handlers = {}
  private readonly _listeners: Listeners = {
    'panel.shown': new Set(),
    'files.dragOver': new Set(),
    'files.dragExit': new Set(),
    'files.dropped': new Set(),
    'upload.progress': new Set(),
    'settings.changed': new Set(),
    'apiKey.changed': new Set(),
  }

  constructor() {
    this.handle('storage.read', async ({ key }) => ({ value: this.storage.get(key) ?? null }))
    this.handle('storage.write', async ({ key, value }) => {
      this.storage.set(key, value)
      return {}
    })
    this.handle('settings.get', async () => ({ prefillLastParent: false }))
    this.handle('log', async () => ({}))
    this.handle('panel.hide', async () => ({}))
    this.handle('panel.beginDrag', async () => ({}))
    this.handle('screenRecording.openSettings', async () => ({}))
    this.handle('panel.resize', async () => ({}))
    this.handle('issue.created', async () => ({}))
    this.handle('upload.cancel', async () => ({}))
  }

  handle<Method extends NativeMethodName>(method: Method, handler: Handler<Method>): void {
    const handlers: { [Key in Method]?: Handler<Key> } = this._handlers
    handlers[method] = handler
  }

  async call<Method extends NativeMethodName>(method: Method, params: NativeMethods[Method]['params']): Promise<NativeMethods[Method]['result']> {
    this.calls.push({ method, params })
    const handlers: { [Key in Method]?: Handler<Key> } = this._handlers
    const handler = handlers[method]
    if (!handler) throw new Error(`FakeNativeBridge: no handler for ${method}`)
    return handler(params)
  }

  on<Event extends NativeEventName>(event: Event, listener: (payload: NativeEvents[Event]) => void): () => void {
    this._listeners[event].add(listener)
    return () => {
      this._listeners[event].delete(listener)
    }
  }

  emit<Event extends NativeEventName>(event: Event, payload: NativeEvents[Event]): void {
    for (const listener of this._listeners[event]) listener(payload)
  }

  callsTo<Method extends NativeMethodName>(method: Method): unknown[] {
    return this.calls.filter((call) => call.method === method).map((call) => call.params)
  }
}
