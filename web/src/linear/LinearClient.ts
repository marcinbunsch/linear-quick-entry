import type { NativeBridge } from '../bridge/NativeBridge'
import type { TypedDocumentString } from './generated/graphql'

/** A failure Linear reported, or a response we could not use. `code` comes from Linear's error extensions when present. */
export class LinearApiError extends Error {
  readonly code: string | null
  readonly status: number

  constructor(message: string, code: string | null, status: number) {
    super(message)
    this.name = 'LinearApiError'
    this.code = code
    this.status = status
  }

  get isRateLimited(): boolean {
    return this.code === 'RATELIMITED' || this.status === 429
  }

  get isAuthenticationFailure(): boolean {
    return this.code === 'AUTHENTICATION_ERROR' || this.status === 401
  }
}

type GraphQLErrorPayload = {
  message: string
  extensions?: { code?: string; userPresentableMessage?: string }
}

type GraphQLEnvelope<Result> = {
  data?: Result | null
  errors?: GraphQLErrorPayload[]
}

/** Sends typed GraphQL documents to Linear through the native side, which owns the API key. */
export class LinearClient {
  private readonly _bridge: NativeBridge

  constructor(bridge: NativeBridge) {
    this._bridge = bridge
  }

  async request<Result, Variables extends Record<string, unknown>>(
    document: TypedDocumentString<Result, Variables>,
    variables: Variables,
  ): Promise<Result> {
    const response = await this._bridge.call('graphql', { query: document.toString(), variables })
    // The response shape is defined by Linear's schema, which the document types are generated from.
    const envelope: GraphQLEnvelope<Result> = parseJson(response.body, response.status)

    const firstError = envelope.errors?.[0]
    if (firstError) {
      const message = firstError.extensions?.userPresentableMessage ?? firstError.message
      throw new LinearApiError(message, firstError.extensions?.code ?? null, response.status)
    }
    if (response.status < 200 || response.status >= 300) {
      throw new LinearApiError(`Linear responded with HTTP ${response.status}`, null, response.status)
    }
    if (envelope.data == null) {
      throw new LinearApiError('Linear returned no data', null, response.status)
    }
    return envelope.data
  }
}

function parseJson(body: string, status: number) {
  try {
    return JSON.parse(body)
  } catch {
    throw new LinearApiError(`Linear returned an unreadable response (HTTP ${status})`, null, status)
  }
}
