import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * The two forecast strips.
 *
 * Both are cards in a row you scroll sideways, with a scrollbar drawn rather
 * than borrowed. The native one is no use here: macOS overlay scrollbars take
 * no layout space and fade out whenever the strip is still, so there would be
 * nothing on screen to say the row continues past the edge of the panel.
 */

const weekly = (page) => page.getByTestId('weekly-forecast')
const hourly = (page) => page.getByTestId('hourly-forecast')

async function metrics(page, testId) {
  return page.evaluate((id) => {
    const scroller = document.querySelector(`[data-testid="${id}"]`)
    const track = document.querySelector(`[data-testid="${id}-bar"]`)
    const thumb = track?.querySelector('.scroll-strip__thumb')
    return {
      cards: scroller.children.length,
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      trackVisible: Boolean(track) && getComputedStyle(track).display !== 'none',
      thumbWidth: thumb ? thumb.getBoundingClientRect().width : 0,
      trackWidth: track ? track.getBoundingClientRect().width : 0
    }
  }, testId)
}

test.describe('Forecast strips', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)
  })

  test('the day strip carries day and night side by side', async ({ page }) => {
    await expect(weekly(page)).toBeVisible()

    const first = weekly(page).locator('.forecast-tile').first()
    // Day and date.
    await expect(first.locator('.forecast-tile__when')).toHaveText('Today')
    await expect(first.locator('.forecast-tile__date')).not.toHaveText('')
    // Two icons, divided.
    await expect(first.locator('.forecast-split__icon')).toHaveCount(2)
    // Precipitation.
    await expect(first.locator('.forecast-tile__pop')).toContainText('%')
    // Two temperatures, divided.
    await expect(first.locator('.forecast-split__temp')).toHaveCount(2)
    // Three dividers in all: one between the icons, one between the temps.
    await expect(first.locator('.forecast-split__rule')).toHaveCount(2)
  })

  test('the day and night temperatures differ', async ({ page }) => {
    // The fixture is warm by day and cold at night, so a card showing the same
    // number twice would mean the split never happened.
    const temps = await weekly(page)
      .locator('.forecast-tile')
      .nth(1)
      .locator('.forecast-split__temp')
      .allTextContents()

    expect(temps).toHaveLength(2)
    expect(temps[0]).not.toBe(temps[1])
  })

  test('the hour strip covers two days, three hours at a time', async ({ page }) => {
    await expect(hourly(page)).toBeVisible()
    // The free forecast is three-hourly, so 48 hours is sixteen or so cards
    // rather than forty-eight. The heading says what is actually covered.
    await expect(hourly(page).locator('h3')).toHaveText(/\d+-Hour Forecast/)
    await expect(hourly(page)).toContainText('Every 3 hours')

    const first = hourly(page).locator('.forecast-tile').first()
    await expect(first.locator('.forecast-tile__icon')).toBeVisible()
    await expect(first.locator('.forecast-tile__temp')).toContainText('°')
    await expect(first.locator('.forecast-tile__pop')).toContainText('%')
    await expect(first.locator('.forecast-tile__when')).not.toHaveText('')
  })

  test('both strips scroll, and both show a bar', async ({ page }) => {
    for (const id of ['weekly-scroller', 'hourly-scroller']) {
      const measured = await metrics(page, id)
      expect(measured.cards, `${id} cards`).toBeGreaterThan(2)
      expect(measured.scrollWidth, `${id} overflows`).toBeGreaterThan(measured.clientWidth)
      expect(measured.trackVisible, `${id} bar is shown`).toBe(true)
      // A thumb narrower than its track is what tells you there is more to see.
      expect(measured.thumbWidth).toBeGreaterThan(0)
      expect(measured.thumbWidth).toBeLessThan(measured.trackWidth)
    }
  })

  test('the bar follows the scroll to the end', async ({ page }) => {
    const rightEdges = await page.evaluate(() => {
      const scroller = document.querySelector('[data-testid="hourly-scroller"]')
      const thumb = document.querySelector('[data-testid="hourly-scroller-bar"] .scroll-strip__thumb')
      const track = document.querySelector('[data-testid="hourly-scroller-bar"]')
      scroller.scrollLeft = scroller.scrollWidth
      return new Promise((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            resolve({
              thumb: Math.round(thumb.getBoundingClientRect().right),
              track: Math.round(track.getBoundingClientRect().right)
            })
          )
        )
      })
    })

    // Scrolled to the end, the thumb should be at the end.
    expect(Math.abs(rightEdges.thumb - rightEdges.track)).toBeLessThanOrEqual(2)
  })

  test('the 12-hour chart is gone, replaced by the hour strip', async ({ page }) => {
    await expect(page.locator('.temperature-card')).toHaveCount(0)
    await expect(hourly(page)).toBeVisible()
  })
})
