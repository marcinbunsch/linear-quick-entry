import { NativeError } from '../bridge/NativeBridge'
import { LinearApiError } from '../linear/LinearClient'
import { strings } from '../i18n/strings'

/** Turns any failure into a sentence the panel can show. */
export function describeError(error: unknown): string {
  if (error instanceof NativeError) {
    if (error.code === 'missingApiKey') return strings.errors.missingApiKey
    if (error.code === 'network') return strings.errors.network
    return error.message
  }
  if (error instanceof LinearApiError) {
    if (error.isAuthenticationFailure) return strings.errors.invalidApiKey
    if (error.isRateLimited) return strings.errors.rateLimited
    return error.message
  }
  if (error instanceof Error) return error.message
  return String(error)
}
