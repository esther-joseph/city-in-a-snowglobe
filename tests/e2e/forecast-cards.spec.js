import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * The two forecast strips.
 *
 * The day strip is cards in a row you scroll sideways. The hourly strip is
 * rows in a column you scroll down, because there are sixteen of them and
 * four fields each, and read down a column those fields line up.
 *
 * Both draw their own scrollbar rather than borrowing one. The native bar is
 * no use here: macOS overlay scrollbars take no layout space and fade out
 * whenever the strip is still, so there would be nothing on screen to say the
 * list continues past the edge.
 */

const weekly = (page) => page.getByTestId('weekly-forecast')
const hourly = (page) => page.getByTestId('hourly-forecast')

async function metrics(page, testId, axis) {
  return page.evaluate(
    ({ id, direction }) => {
      const scroller = document.querySelector(`[data-testid="${id}"]`)
      const track = document.querySelector(`[data-testid="${id}-bar"]`)
      const thumb = track?.querySelector('.scroll-strip__thumb')
      const down = direction === 'y'
      return {
        cards: scroller.children.length,
        total: down ? scroller.scrollHeight : scroller.scrollWidth,
        visible: down ? scroller.clientHeight : scroller.clientWidth,
        trackVisible: Boolean(track) && getComputedStyle(track).display !== 'none',
        thumbLength: thumb
          ? down
            ? thumb.getBoundingClientRect().height
            : thumb.getBoundingClientRect().width
          : 0,
        trackLength: track
          ? down
            ? track.getBoundingClientRect().height
            : track.getBoundingClientRect().width
          : 0
      }
    },
    { id: testId, direction: axis }
  )
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

  test('the hour strip reads time, icon, temperature, precipitation', async ({ page }) => {
    await expect(hourly(page)).toBeVisible()
    // The free forecast is three-hourly, so 48 hours is sixteen or so rows
    // rather than forty-eight. The heading says what is actually covered.
    await expect(hourly(page).locator('h3')).toHaveText(/\d+-Hour Forecast/)
    await expect(hourly(page)).toContainText('Every 3 hours')

    const first = hourly(page).locator('.forecast-row').first()
    await expect(first.locator('.forecast-row__when')).not.toHaveText('')
    await expect(first.locator('.forecast-row__icon')).toBeVisible()
    await expect(first.locator('.forecast-row__temp')).toContainText('°')
    await expect(first.locator('.forecast-row__pop')).toContainText('%')

    // In that order, left to right. Matched by containment rather than by the
    // first class name: MeteoconIcon puts its own class ahead of the one the
    // row gives it.
    const wanted = [
      'forecast-row__when',
      'forecast-row__icon',
      'forecast-row__temp',
      'forecast-row__pop'
    ]
    const order = await first.evaluate(
      (row, classes) =>
        Array.from(row.children).map(
          (child) => classes.find((name) => child.classList.contains(name)) ?? child.className
        ),
      wanted
    )
    expect(order).toEqual(wanted)
  })

  test('the weekday shares the time cell so the columns stay aligned', async ({ page }) => {
    const rows = hourly(page).locator('.forecast-row')
    const daybreak = hourly(page).locator('.forecast-row--daybreak').first()
    await expect(daybreak).toBeVisible()
    // Weekday and hour together, divided, in the one cell.
    await expect(daybreak.locator('.forecast-row__weekday')).not.toHaveText('')
    await expect(daybreak.locator('.forecast-row__when')).toContainText(/[A-Za-z]{3}/)

    // Every row's four columns start on the same four verticals, which is the
    // whole reason the weekday shares the cell instead of sitting above it.
    const lefts = await rows.evaluateAll((all) =>
      all
        .slice(0, 8)
        .map((row) => Array.from(row.children).map((c) => Math.round(c.getBoundingClientRect().left)))
    )
    for (const row of lefts) {
      expect(row).toEqual(lefts[0])
    }
  })

  test('the hour strip scrolls down, not sideways', async ({ page }) => {
    const measured = await metrics(page, 'hourly-scroller', 'y')
    expect(measured.cards).toBeGreaterThan(8)
    expect(measured.total, 'taller than the window it sits in').toBeGreaterThan(
      measured.visible
    )
    expect(measured.trackVisible).toBe(true)
    expect(measured.thumbLength).toBeGreaterThan(0)
    expect(measured.thumbLength).toBeLessThan(measured.trackLength)

    const sideways = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hourly-scroller"]')
      return el.scrollWidth <= el.clientWidth + 1
    })
    expect(sideways, 'nothing hidden off to the side').toBe(true)
  })

  test('the day strip scrolls sideways, and shows a bar', async ({ page }) => {
    const measured = await metrics(page, 'weekly-scroller', 'x')
    expect(measured.cards).toBeGreaterThan(2)
    expect(measured.total).toBeGreaterThan(measured.visible)
    expect(measured.trackVisible).toBe(true)
    // A thumb shorter than its track is what tells you there is more to see.
    expect(measured.thumbLength).toBeGreaterThan(0)
    expect(measured.thumbLength).toBeLessThan(measured.trackLength)
  })

  test('each bar follows its own scroll to the end', async ({ page }) => {
    const edges = await page.evaluate(() => {
      const read = (id, down) => {
        const scroller = document.querySelector(`[data-testid="${id}"]`)
        const track = document.querySelector(`[data-testid="${id}-bar"]`)
        const thumb = track.querySelector('.scroll-strip__thumb')
        if (down) scroller.scrollTop = scroller.scrollHeight
        else scroller.scrollLeft = scroller.scrollWidth
        return { scroller, track, thumb, down }
      }
      const weekly = read('weekly-scroller', false)
      const hourly = read('hourly-scroller', true)
      return new Promise((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            resolve({
              weekly: {
                thumb: Math.round(weekly.thumb.getBoundingClientRect().right),
                track: Math.round(weekly.track.getBoundingClientRect().right)
              },
              hourly: {
                thumb: Math.round(hourly.thumb.getBoundingClientRect().bottom),
                track: Math.round(hourly.track.getBoundingClientRect().bottom)
              }
            })
          )
        )
      })
    })

    // Scrolled to the end, each thumb should be at the end of its track.
    expect(Math.abs(edges.weekly.thumb - edges.weekly.track)).toBeLessThanOrEqual(2)
    expect(Math.abs(edges.hourly.thumb - edges.hourly.track)).toBeLessThanOrEqual(2)
  })

  test('the 12-hour chart is gone, replaced by the hour strip', async ({ page }) => {
    await expect(page.locator('.temperature-card')).toHaveCount(0)
    await expect(hourly(page)).toBeVisible()
  })
})
