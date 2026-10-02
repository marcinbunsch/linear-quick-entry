import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { AppController } from './state/AppController'
import { FakeNativeBridge } from './test/FakeNativeBridge'
import { checkoutEpic, ids, respondToGraphQL, seedReferenceDataCache } from './test/fixtures'

async function renderPanel() {
  const bridge = new FakeNativeBridge()
  seedReferenceDataCache(bridge, Date.now())
  bridge.storage.set(
    'preferences',
    JSON.stringify({ version: 1, value: { lastTeamId: ids.engineering, lastProjectId: null, lastParent: checkoutEpic, recentParents: [checkoutEpic] } }),
  )
  const app = new AppController(bridge)
  await app.start()
  render(<App app={app} />)
  return { app, bridge, user: userEvent.setup() }
}

describe('App', () => {
  let appToDispose: AppController | null = null
  afterEach(() => {
    cleanup()
    appToDispose?.dispose()
  })

  it('opens with the team key, default status and the engineering-only chips', async () => {
    const { app } = await renderPanel()
    appToDispose = app

    const chips = screen.getByTestId('field-chips')
    expect(within(chips).getByText('Backlog')).toBeInTheDocument()
    expect(within(chips).getByText('Cycle 41')).toBeInTheDocument()
    expect(within(chips).getByText('Estimate')).toBeInTheDocument()
    expect(screen.getByText('ENG')).toBeInTheDocument()
    expect(screen.getByTestId('parent-suggestion')).toHaveTextContent('Sub-issue of ENG-101?')
  })

  it('⌘⇧S then picking a status -> status chip updated', async () => {
    const { app, user } = await renderPanel()
    appToDispose = app

    await user.click(screen.getByTestId('title-input'))
    await user.keyboard('{Meta>}{Shift>}s{/Shift}{/Meta}')
    const popover = await screen.findByTestId('picker-status-popover')
    await user.click(within(popover).getByText('In Progress'))

    expect(app.draft.fields.stateId).toBe(ids.engInProgress)
    expect(within(screen.getByTestId('field-chips')).getByText('In Progress')).toBeInTheDocument()
  })

  it('switching to a team without estimates or cycles -> those chips disappear', async () => {
    const { app } = await renderPanel()
    appToDispose = app

    act(() => app.draft.setTeam(ids.design))

    const chips = screen.getByTestId('field-chips')
    expect(within(chips).queryByText('Estimate')).not.toBeInTheDocument()
    expect(within(chips).queryByText('Cycle 41')).not.toBeInTheDocument()
  })

  it('typing a title and pressing Escape -> panel hidden, title kept in the draft', async () => {
    const { app, bridge, user } = await renderPanel()
    appToDispose = app

    await user.click(screen.getByTestId('title-input'))
    await user.keyboard('Checkout total rounds wrong{Escape}')

    expect(bridge.callsTo('panel.hide')).toHaveLength(1)
    expect(app.draft.fields.title).toBe('Checkout total rounds wrong')
  })

  it('Escape while a picker is open -> only the picker closes', async () => {
    const { app, bridge, user } = await renderPanel()
    appToDispose = app

    await user.click(screen.getByTestId('title-input'))
    await user.keyboard('{Meta>}{Shift>}p{/Shift}{/Meta}')
    await screen.findByTestId('picker-priority-popover')
    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('picker-priority-popover')).not.toBeInTheDocument()
    expect(bridge.callsTo('panel.hide')).toEqual([])
  })

  it('"…" menu then Due date -> due date picker opens in its place, and the chip appears', async () => {
    const { app, user } = await renderPanel()
    appToDispose = app
    expect(within(screen.getByTestId('field-chips')).queryByText('Due date')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('More fields'))
    const menu = await screen.findByTestId('picker-more-popover')
    await user.click(within(menu).getByText('Due date'))

    expect(await screen.findByTestId('picker-dueDate-popover')).toBeInTheDocument()
    expect(screen.queryByTestId('picker-more-popover')).not.toBeInTheDocument()
    expect(app.openPicker).toBe('dueDate')
  })

  it('Create more switched on, then ⌘↩ -> issue created and the panel stays open', async () => {
    const { app, bridge, user } = await renderPanel()
    appToDispose = app
    respondToGraphQL(bridge, {
      CreateIssue: () => ({ issueCreate: { success: true, issue: { id: 'ba5e0000-0000-4000-8000-000000000150', identifier: 'ENG-150', title: 'Checkout total rounds wrong', url: 'https://linear.app/acme/issue/ENG-150' } } }),
    })

    await user.click(screen.getByTestId('create-more'))
    await user.click(screen.getByTestId('title-input'))
    await user.keyboard('Checkout total rounds wrong{Meta>}{Enter}{/Meta}')

    await vi.waitFor(() => expect(bridge.callsTo('issue.created')).toHaveLength(1))
    expect(bridge.callsTo('panel.hide')).toEqual([])
    expect(screen.getByTestId('create-more')).toHaveAttribute('aria-checked', 'true')
  })

  it('mouse-down on empty header space -> window drag starts; on a chip or the title -> it does not', async () => {
    const { app, bridge } = await renderPanel()
    appToDispose = app

    fireEvent.mouseDown(screen.getByText('New issue'))
    fireEvent.mouseDown(screen.getByText('ENG'))
    fireEvent.mouseDown(screen.getByTestId('title-input'))

    expect(bridge.callsTo('panel.beginDrag')).toHaveLength(1)
  })
})
