import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * The written part of the site.
 *
 * AdSense turned the site down on two findings, and they are the same
 * finding twice: ads were being served on a screen with no publisher content
 * on it, and there was no publisher content anywhere else either. The app is
 * a canvas and a panel of readings — a tool, not a page — and that is not a
 * thing to put an advert on.
 *
 * So the advertising moved to pages that have something written on them, and
 * those pages had to be written. What is checked here is that they exist,
 * that they say something, that they are joined up, and that the globe screen
 * itself carries no ad markup at all.
 */

const PAGES = [
  { path: '/how-it-works', heading: /reads the weather/i },
  { path: '/seasons', heading: /seasons/i },
  { path: '/augmented-reality', heading: /inside the globe/i },
  { path: '/about', heading: /about/i },
  { path: '/privacy', heading: /privacy/i }
]

test.describe('Pages with something on them', () => {
  for (const page of PAGES) {
    test(`${page.path} is a page, not a stub`, async ({ page: browser }) => {
      const response = await browser.goto(page.path)
      expect(response?.status(), 'served').toBeLessThan(400)

      await expect(browser.locator('h1')).toHaveText(page.heading)

      // Enough to be worth reading. Thin content is the other half of what
      // the review objected to.
      const words = await browser.evaluate(
        () => document.body.innerText.trim().split(/\s+/).length
      )
      expect(words, `${page.path} has substance`).toBeGreaterThan(400)

      // Joined up, in both directions: every page reaches the globe and its
      // neighbours.
      await expect(browser.locator('a[href="/"]').first()).toBeVisible()
      for (const other of PAGES) {
        if (other.path === page.path) continue
        await expect(
          browser.locator(`a[href="${other.path}"]`).first(),
          `${page.path} links to ${other.path}`
        ).toHaveCount(1, { timeout: 5000 })
      }
    })
  }

  test('each page describes itself for a search result', async ({ page }) => {
    for (const entry of PAGES) {
      await page.goto(entry.path)
      const meta = await page
        .locator('meta[name="description"]')
        .getAttribute('content')
      expect(meta, `${entry.path} has a description`).toBeTruthy()
      expect(meta.length).toBeGreaterThan(50)

      const canonical = await page.locator('link[rel="canonical"]').count()
      // Privacy predates the others and is linked from the store listing by
      // its own URL; the rest declare a canonical.
      if (entry.path !== '/privacy') expect(canonical).toBe(1)
    }
  })

  test('the sitemap lists them all', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    for (const entry of PAGES) {
      expect(sitemap, `sitemap has ${entry.path}`).toContain(entry.path)
    }
  })
})

test.describe('No ads on the screen without content', () => {
  test('the globe screen carries no ad markup', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    // Not hidden, not empty, not there: an AdSense unit on this screen is
    // what the review objected to.
    await expect(page.locator('ins.adsbygoogle')).toHaveCount(0)
    await expect(page.locator('[data-ad-client]')).toHaveCount(0)
  })

  test('and asks for none, whatever the slot config says', async ({ page }) => {
    await gotoApp(page)

    const answers = await page.evaluate(async () => {
      const { adsEnabled } = await import('/src/services/ads/adProvider.js')
      return {
        web: adsEnabled({ platform: 'web' }),
        webInAR: adsEnabled({ platform: 'web', renderMode: 'ar' }),
        // The packaged Android app is a different product under different
        // rules, and keeps its AdMob path.
        native: adsEnabled({ platform: 'native' }),
        nativeInAR: adsEnabled({ platform: 'native', renderMode: 'ar' })
      }
    })

    expect(answers.web).toBe(false)
    expect(answers.webInAR).toBe(false)
    expect(answers.native).toBe(true)
    // Still never over a live camera view, on any platform.
    expect(answers.nativeInAR).toBe(false)
  })

  test('the globe links out to the writing', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    for (const entry of PAGES) {
      await expect(
        page.locator(`a[href="${entry.path}"]`),
        `the drawer links to ${entry.path}`
      ).toHaveCount(1)
    }
  })
})
