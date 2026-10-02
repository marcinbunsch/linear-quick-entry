import { describe, expect, it } from 'vitest'
import { FakeNativeBridge } from '../test/FakeNativeBridge'
import { ViewerAndOrganizationQuery } from './documents'
import { LinearApiError, LinearClient } from './LinearClient'

const viewerResponse = {
  viewer: { id: 'a5e10000-0000-4000-8000-000000000001', name: 'Marcin Bunsch', displayName: 'marcin', avatarUrl: null },
  organization: { id: 'f0f00000-0000-4000-8000-000000000001', name: 'Acme', urlKey: 'acme' },
}

describe('LinearClient', () => {
  it('successful response -> data returned and query text sent through the bridge', async () => {
    const bridge = new FakeNativeBridge()
    bridge.handle('graphql', async () => ({ status: 200, body: JSON.stringify({ data: viewerResponse }) }))

    const result = await new LinearClient(bridge).request(ViewerAndOrganizationQuery, {})

    expect(result.organization.name).toBe('Acme')
    const [sent] = bridge.callsTo('graphql')
    expect(sent).toMatchObject({ variables: {} })
    expect(JSON.stringify(sent)).toContain('query ViewerAndOrganization')
  })

  it('GraphQL error with a user-facing message -> that message, with Linear error code', async () => {
    const bridge = new FakeNativeBridge()
    bridge.handle('graphql', async () => ({
      status: 400,
      body: JSON.stringify({
        errors: [
          {
            message: 'Authentication required, not authenticated',
            extensions: { code: 'AUTHENTICATION_ERROR', userPresentableMessage: 'You need to authenticate to access this operation.' },
          },
        ],
      }),
    }))

    const failure = await new LinearClient(bridge).request(ViewerAndOrganizationQuery, {}).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(LinearApiError)
    expect(failure).toMatchObject({ message: 'You need to authenticate to access this operation.', code: 'AUTHENTICATION_ERROR', status: 400 })
  })

  it('HTML error page from a proxy -> readable failure instead of a JSON exception', async () => {
    const bridge = new FakeNativeBridge()
    bridge.handle('graphql', async () => ({ status: 502, body: '<html><body>Bad Gateway</body></html>' }))

    const failure = await new LinearClient(bridge).request(ViewerAndOrganizationQuery, {}).catch((error: unknown) => error)

    expect(failure).toMatchObject({ message: 'Linear returned an unreadable response (HTTP 502)', status: 502 })
  })

  it('HTTP 429 without GraphQL errors -> recognised as rate limiting', async () => {
    const bridge = new FakeNativeBridge()
    bridge.handle('graphql', async () => ({ status: 429, body: '{}' }))

    const failure = await new LinearClient(bridge).request(ViewerAndOrganizationQuery, {}).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(LinearApiError)
    expect(failure instanceof LinearApiError && failure.isRateLimited).toBe(true)
  })
})
