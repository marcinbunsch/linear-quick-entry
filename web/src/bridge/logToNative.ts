import type { NativeBridge } from './NativeBridge'
import type { NativeMethods } from './protocol'

type LogParams = NativeMethods['log']['params']

/** Sends a structured log line to the native unified log (Console.app, subsystem pl.bunsch.LinearQuickEntry). */
export async function logToNative(
  bridge: NativeBridge,
  level: LogParams['level'],
  message: string,
  fields: LogParams['fields'] = {},
): Promise<void> {
  try {
    await bridge.call('log', { level, message, fields })
  } catch {
    // Logging must never break the caller; if the bridge itself is down there is nowhere left to report to.
  }
}
