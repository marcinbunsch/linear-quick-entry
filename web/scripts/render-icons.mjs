// Renders design/AppIcon.svg into the app icon set using WebKit. The menu bar icon is the SVG itself
// (LinearQuickEntry/Assets.xcassets/MenuBarIcon.imageset), so it needs no rendering.
// Usage: node web/scripts/render-icons.mjs   (run from the repository root)
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { webkit } from 'playwright'

const iconSetDir = 'LinearQuickEntry/Assets.xcassets/AppIcon.appiconset'
// macOS app icon sizes in points, each at 1x and 2x.
const pointSizes = [16, 32, 128, 256, 512]

const appIconSvg = await readFile('design/AppIcon.svg', 'utf8')
const browser = await webkit.launch()
const page = await browser.newPage()

async function renderPng(svg, pixels) {
  await page.setViewportSize({ width: pixels, height: pixels })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg style="display:block;width:${pixels}px;height:${pixels}px" `)}</body></html>`)
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: pixels, height: pixels } })
}

await mkdir(iconSetDir, { recursive: true })
const images = []
for (const points of pointSizes) {
  for (const scale of [1, 2]) {
    const filename = `icon_${points}x${points}${scale === 2 ? '@2x' : ''}.png`
    await writeFile(`${iconSetDir}/${filename}`, await renderPng(appIconSvg, points * scale))
    images.push({ size: `${points}x${points}`, idiom: 'mac', filename, scale: `${scale}x` })
  }
}
await writeFile(`${iconSetDir}/Contents.json`, `${JSON.stringify({ images, info: { version: 1, author: 'xcode' } }, null, 2)}\n`)

await browser.close()
console.log(`wrote ${images.length} icon sizes to ${iconSetDir}`)
