import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * The parts of the site a reviewer or a crawler looks for, rather than a
 * reader: the policy page, robots.txt, the sitemap, and the link that leads to
 * the policy from inside the app.
 *
 * These used to be swallowed by the catch-all rewrite in vercel.json, which
 * answered every unmatched path with the app's own HTML and a 200 — so
 * /robots.txt was a WebGL page and /privacy did not exist.
 */

test.describe('Crawler files', () => {
  test('robots.txt allows the site and names the sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')

    const body = await response.text()
    expect(body).toContain('User-agent: *')
    expect(body).toContain('Allow: /')
    expect(body).toContain('Sitemap: https://www.city-in-a-snowglobe.com/sitemap.xml')
    // The proxy answers requests, not pages.
    expect(body).toContain('Disallow: /api/')
  })

  test('the sitemap is XML and lists the pages that exist', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')

    const body = await response.text()
    expect(body).toContain('<loc>https://www.city-in-a-snowglobe.com/</loc>')
    expect(body).toContain('<loc>https://www.city-in-a-snowglobe.com/privacy</loc>')
  })
})

test.describe('Privacy policy', () => {
  test('is served at /privacy, not the app', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page).toHaveTitle(/Privacy Policy/)
    await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible()
    // A policy page with a WebGL canvas on it means the SPA fallback answered.
    await expect(page.locator('canvas')).toHaveCount(0)
  })

  test('discloses what AdSense reviewers look for', async ({ page }) => {
    await page.goto('/privacy')
    const body = page.locator('body')
    await expect(body).toContainText('Google AdSense')
    await expect(body).toContainText('cookies')
    await expect(body).toContainText(/personalised advertising/i)
    // The client-side cache is storage on the reader's device, so it is named.
    await expect(body).toContainText('fifteen minutes')
    await expect(page.getByRole('link', { name: /Google Ads Settings/i })).toBeVisible()
  })

  test('is reachable from inside the app', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    const link = page.getByRole('link', { name: /Privacy Policy/i })
    await expect(link).toHaveAttribute('href', '/privacy')
    // A new tab, so following it does not tear down the scene.
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
  })
})
