// Photographs the preview page in WebKit (the engine the app uses) for visual review.
// Usage: pnpm dev (in another terminal), then: node scripts/screenshot-preview.mjs [outputDir]
import { webkit } from 'playwright'

const outputDir = process.argv[2] ?? '/tmp/lqe-shots'
const shots = [
  { name: 'empty', query: 'scenario=empty' },
  { name: 'empty-white', query: 'scenario=empty&backdrop=white' },
  { name: 'filled', query: 'scenario=filled' },
  { name: 'subissue', query: 'scenario=subissue' },
  { name: 'status-picker', query: 'scenario=filled&picker=status' },
  { name: 'parent-picker', query: 'scenario=empty&picker=parent' },
]

const browser = await webkit.launch()
for (const colorScheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 784, height: 640 }, deviceScaleFactor: 2, colorScheme })
  for (const shot of shots) {
    await page.goto(`http://localhost:5173/preview.html?${shot.query}`)
    await page.waitForSelector('[data-testid="issue-modal"]')
    await page.waitForTimeout(300)
    // The panel plus any open picker, without the empty viewport below it.
    const frame = await page.locator('#root > div').boundingBox()
    const height = frame?.height ?? 640
    await page.screenshot({ path: `${outputDir}/${shot.name}-${colorScheme}.png`, clip: { x: 0, y: 0, width: 784, height } })
  }
  await page.close()
}
await browser.close()
console.log(`saved to ${outputDir}`)
