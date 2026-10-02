import type { NativeBridge } from '../bridge/NativeBridge'
import type { StorageKey } from '../bridge/protocol'
import { logToNative } from '../bridge/logToNative'

type Envelope<Value> = { version: number; value: Value }

/**
 * Reads and writes one JSON value under a storage key in the app's Application Support folder.
 * Values are tagged with a version; a stored value from another version is ignored rather than migrated,
 * because everything stored here is a cache, a draft or a preference that is cheap to lose.
 */
export class PersistentStore<Value> {
  private readonly _bridge: NativeBridge
  private readonly _key: StorageKey
  private readonly _version: number

  constructor(bridge: NativeBridge, key: StorageKey, version: number) {
    this._bridge = bridge
    this._key = key
    this._version = version
  }

  async read(): Promise<Value | null> {
    const { value } = await this._bridge.call('storage.read', { key: this._key })
    if (value == null) return null
    try {
      // Only this class writes these files, always as an Envelope of this store's Value type.
      const envelope: Envelope<Value> = JSON.parse(value)
      if (envelope.version !== this._version) return null
      return envelope.value
    } catch {
      // A corrupt file is treated like a missing one; the next write replaces it.
      return null
    }
  }

  /** Never throws: a failed save is logged and the next change saves again. */
  async write(value: Value): Promise<void> {
    const envelope: Envelope<Value> = { version: this._version, value }
    try {
      await this._bridge.call('storage.write', { key: this._key, value: JSON.stringify(envelope) })
    } catch (error) {
      await logToNative(this._bridge, 'warning', 'storage write failed', { key: this._key, error: String(error) })
    }
  }
}
