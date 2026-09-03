/**
 * Renders the Play Store app icon (512x512) and feature graphic (1024x500)
 * from the live app, so the artwork is the real snow globe rather than a mock.
 *
 * Usage: npm run dev, then: node scripts/capture-brand-assets.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const BASE_URL = process.env.CAPTURE_URL || 'http://localhost:3000'
const OUT_DIR = path.resolve('assets/play-store')
const WORK_DIR = path.join(OUT_DIR, '_work')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const HIDE_UI = `
  button, .controls-hint { display: none !important; }
`

async function renderScene(browser, { width, height, scale, hour, zoom, city }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale
  })
  const page = await context.newPage()
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas')
  await page.waitForSelector('.summary-temp, .temperature', { timeout: 30000 })

  await page.click('button[aria-label="Open Weather Info"]')
  if (city && city !== 'New York') {
    await page.fill('.city-input', city)
    await page.click('.search-button')
    await page.waitForFunction((c) => document.body.innerText.includes(c), city, { timeout: 30000 })
  }
  if (hour !== undefined) {
    await page.waitForSelector('.time-slider')
    await page.evaluate((value) => {
      const slider = document.querySelector('.time-slider')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(slider, String(value))
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      slider.dispatchEvent(new Event('change', { bubbles: true }))
    }, hour)
  }
  await page.click('button[aria-label="Close Weather Info"]')
  await page.addStyleTag({ content: HIDE_UI })

  const box = await page.locator('canvas').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < Math.abs(zoom); i += 1) {
    await page.mouse.wheel(0, zoom < 0 ? -240 : 240)
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(6000)
  return { page, context }
}

async function main() {
  fs.mkdirSync(WORK_DIR, { recursive: true })
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--hide-scrollbars', '--force-color-profile=srgb']
  })

  const fresh = process.argv.includes('--fresh')
  const has = (f) => fs.existsSync(path.join(WORK_DIR, f))

  // 1. Icon source: square night render, globe filling most of the frame.
  if (fresh || !has('icon-source.png')) {
    const { page, context } = await renderScene(browser, {
      width: 512, height: 512, scale: 2, hour: 21, zoom: -13, city: 'New York'
    })
    await page.screenshot({ path: path.join(WORK_DIR, 'icon-source.png') })
    await context.close()
  }

  // 2. Feature graphic source: wide night render used as the artwork plate.
  if (fresh || !has('feature-source.png')) {
    const { page, context } = await renderScene(browser, {
      width: 1024, height: 500, scale: 2, hour: 21, zoom: -5, city: 'New York'
    })
    await page.screenshot({ path: path.join(WORK_DIR, 'feature-source.png') })
    await context.close()
  }

  // 3. Feature graphic: the wide render as artwork, app name set over it.
  {
    const html = featureHtml(path.join(WORK_DIR, 'feature-source.png'))
    const htmlPath = path.join(WORK_DIR, 'feature.html')
    fs.writeFileSync(htmlPath, html)
    const context = await browser.newContext({
      viewport: { width: 1024, height: 500 },
      deviceScaleFactor: 2
    })
    const page = await context.newPage()
    await page.goto(`file://${htmlPath}`)
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(WORK_DIR, 'feature-2x.png') })
    await context.close()
  }

  await browser.close()
  console.log('wrote', path.join(WORK_DIR, 'icon-source.png'))
  console.log('wrote', path.join(WORK_DIR, 'feature-2x.png'))
}

// Left: app name over a scrim. Right: the globe. Nothing important within
// ~8% of any edge, since Play crops the graphic differently per placement.
function featureHtml(imagePath) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1024px; height: 500px; overflow: hidden; position: relative;
    background: #171a3a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }
  .plate {
    position: absolute; inset: 0;
    background-image: url('file://${imagePath}');
    background-size: 150% auto;
    background-position: 10% 41%;
    background-repeat: no-repeat;
  }
  .scrim {
    position: absolute; inset: 0;
    background: linear-gradient(100deg,
      rgba(12, 14, 40, 0.97) 0%,
      rgba(12, 14, 40, 0.92) 26%,
      rgba(14, 16, 44, 0.55) 46%,
      rgba(14, 16, 44, 0) 64%);
  }
  .copy {
    position: absolute; left: 76px; top: 50%; transform: translateY(-50%);
    max-width: 470px; color: #fff;
  }
  h1 {
    font-size: 62px; line-height: 1.04; font-weight: 700; letter-spacing: -1.4px;
    text-shadow: 0 4px 26px rgba(0, 0, 0, 0.55);
  }
  h1 .accent { color: #f4d089; }
  p {
    margin-top: 20px; font-size: 25px; line-height: 1.4; font-weight: 400;
    color: rgba(255, 255, 255, 0.82);
  }
  .rule {
    margin-top: 26px; width: 92px; height: 4px; border-radius: 2px;
    background: linear-gradient(90deg, #f4d089, rgba(244, 208, 137, 0));
  }
</style></head>
<body>
  <div class="plate"></div>
  <div class="scrim"></div>
  <div class="copy">
    <h1>City In A<br><span class="accent">SnowGlobe</span></h1>
    <p>Real-time weather for any city, inside a living 3D snow globe.</p>
    <div class="rule"></div>
  </div>
</body></html>`
}

await main()
