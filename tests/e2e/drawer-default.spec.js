import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'
import { SIDE_BY_SIDE_WIDTH } from '../../src/utils/drawerDefault.js'

/**
 * Whether the weather panel is out when the app opens.
 *
 * Closed everywhere, the landing screen was a canvas with a menu button on
 * it: nothing to read — which is the whole of what the AdSense review
 * objected to — and no sign that the forecast was in there at all.
 *
 * Open everywhere is worse on a phone, where the panel is the entire screen
 * and the globe somebody came to look at is behind it. So it depends on
 * whether there is room for both, and this is where that is checked.
 */

test.describe('The panel on arrival', () => {
  test('depends on whether the globe can be beside it', async ({ page }) => {
    await gotoApp(page)

    const answers = await page.evaluate(async () => {
      const { drawerOpensOnLoad, SIDE_BY_SIDE_WIDTH } = await import(
        '/src/utils/drawerDefault.js'
      )
      return {
        desktop: drawerOpensOnLoad({}, 1440),
        tablet: drawerOpensOnLoad({}, SIDE_BY_SIDE_WIDTH),
        justUnder: drawerOpensOnLoad({}, SIDE_BY_SIDE_WIDTH - 1),
        phone: drawerOpensOnLoad({}, 393),
        // The manifest's "Change city" shortcut, which means it wherever it
        // is opened.
        askedFor: drawerOpensOnLoad({ panelOpen: true }, 393),
        // Nothing to measure is not a reason to throw.
        unmeasured: drawerOpensOnLoad({}, 0)
      }
    })

    expect(answers.desktop).toBe(true)
    expect(answers.tablet).toBe(true)
    expect(answers.justUnder).toBe(false)
    expect(answers.phone).toBe(false)
    expect(answers.askedFor).toBe(true)
    expect(answers.unmeasured).toBe(false)
  })

  test('is out on load where there is room, shut where there is not', async ({ page }) => {
    await gotoApp(page)

    const width = page.viewportSize().width
    const roomForBoth = width >= SIDE_BY_SIDE_WIDTH

    if (roomForBoth) {
      // The readings are the landing screen, and the globe is beside them
      // rather than behind them.
      await expect(page.getByRole('button', { name: /Close Weather Info/i })).toBeVisible()
      await expect(page.getByTestId('weather-drawer')).toHaveAttribute('data-open', 'true')

      const panel = await page.getByTestId('weather-drawer').boundingBox()
      expect(panel.width, 'the panel leaves the globe room').toBeLessThan(width * 0.75)

      // And the advertising is mounted with it, rather than waiting behind a
      // tap most visitors never make.
      await expect(page.getByTestId('ad-slot-drawer-footer')).toHaveCount(1)
    } else {
      // A phone: the panel is the whole screen, so it waits to be asked for.
      await expect(page.getByRole('button', { name: /Open Weather Info/i })).toBeVisible()
      await expect(page.getByTestId('weather-drawer')).toHaveAttribute('data-open', 'false')
      await expect(page.getByTestId('ad-slot-drawer-footer')).toHaveCount(0)
    }
  })

  test('?panel=open overrides it, at any size', async ({ page }) => {
    await gotoApp(page, '/?panel=open')

    await expect(page.getByRole('button', { name: /Close Weather Info/i })).toBeVisible()
    await expect(page.getByTestId('weather-drawer')).toHaveAttribute('data-open', 'true')
  })
})
