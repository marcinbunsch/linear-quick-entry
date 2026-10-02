import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../App'
import { AppController } from '../state/AppController'
import { PICKER_NAMES } from '../state/shortcuts'
import { FakeNativeBridge } from '../test/FakeNativeBridge'
import { checkoutEpic, ids, respondToGraphQL, screenshotFile, seedReferenceDataCache } from '../test/fixtures'
import '../styles.css'

// Renders the panel in a plain browser with the sample "Acme" workspace, for working on the look
// without the native app. Open /preview.html?scenario=filled&picker=status while `pnpm dev` runs.

const parameters = new URLSearchParams(window.location.search)
const scenario = parameters.get('scenario') ?? 'empty'
const picker = PICKER_NAMES.find((name) => name === parameters.get('picker')) ?? null
// A white desktop shows any shadow clipping most clearly.
if (parameters.get('backdrop') === 'white') document.documentElement.classList.add('white-backdrop')

const bridge = new FakeNativeBridge()
seedReferenceDataCache(bridge, Date.now())
bridge.storage.set(
  'preferences',
  JSON.stringify({ version: 1, value: { lastTeamId: ids.engineering, lastProjectId: null, lastParent: checkoutEpic, recentParents: [checkoutEpic] } }),
)
bridge.handle('upload.start', () => new Promise(() => {}))
const myOpenIssues = [
  ['ENG-183', 'Experiences - search results show stale availability after a booking'],
  ['ENG-177', 'Milestone 4: Apple Pay and Google Pay in the new checkout'],
  ['ENG-149', 'Autoscaling: workers stay at peak size overnight'],
].map(([identifier, title], index) => ({
  id: `ba5e0000-0000-4000-8000-00000000030${index}`,
  identifier,
  title,
  team: { id: ids.engineering },
  project: null,
  state: { name: 'In Progress', type: 'started', color: '#f2c94c' },
}))
respondToGraphQL(bridge, { MyOpenIssues: () => ({ viewer: { assignedIssues: { nodes: myOpenIssues } } }) })

const app = new AppController(bridge)
await app.start()

if (scenario === 'filled' || scenario === 'subissue') {
  app.draft.setTitle('Card form loses focus after the 3DS redirect')
  app.editor.setContent({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Happens on Safari only, every time the bank page sends you back.' }] }],
  })
  app.draft.setStatus(ids.engTodo)
  app.draft.setPriority(2)
  app.draft.setAssignee(ids.me)
  app.draft.toggleLabel(ids.bugLabel)
  app.draft.setEstimate(3)
  app.draft.addTrayAttachments(app.attachments.add([screenshotFile()]))
}
if (scenario === 'subissue') app.draft.setParent(checkoutEpic)
if (picker) app.setOpenPicker(picker)

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element')
createRoot(rootElement).render(
  <StrictMode>
    <App app={app} />
  </StrictMode>,
)
