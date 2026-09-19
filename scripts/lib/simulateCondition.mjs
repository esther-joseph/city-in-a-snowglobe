/**
 * Pins the weather for a capture.
 *
 * Some listing shots are named for a sky — a clear midday, a snowfall — that
 * the real city will not supply on the day the artwork is made. This rewrites
 * only the condition code in the live API response, so what is rendered is the
 * app's own drawing of that condition.
 *
 * Note the URL it matches. The app stopped calling api.openweathermap.org when
 * the proxy landed: every request now goes to /api/openweather with the
 * upstream path as a query parameter, so matching has to happen on that
 * parameter. A pattern like '**\/data/2.5/weather*' silently matches nothing.
 */

export const CONDITION_PATCHES = {
  snow: { id: 601, main: 'Snow', description: 'snow', icon: '13d' },
  clear: { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }
}

/**
 * @param {import('playwright-core').Page} page
 * @param {'snow'|'clear'} condition
 */
export async function simulateCondition(page, condition) {
  const patch = CONDITION_PATCHES[condition]
  if (!patch) throw new Error(`No patch for condition: ${condition}`)

  await page.route('**/api/openweather*', async (route) => {
    const path = new URL(route.request().url()).searchParams.get('path')
    const response = await route.fetch()

    if (path === 'data/2.5/weather') {
      const json = await response.json()
      json.weather = [patch]
      // Snow at 70F would read as a bug, so the temperature comes along.
      if (condition === 'snow') json.main = { ...json.main, temp: 28, feels_like: 21 }
      await route.fulfill({ response, json })
      return
    }

    if (path === 'data/2.5/forecast') {
      const json = await response.json()
      json.list = (json.list || []).map((entry) => ({
        ...entry,
        weather: [patch],
        main:
          condition === 'snow'
            ? { ...entry.main, temp: Math.min(entry.main?.temp ?? 28, 30) }
            : entry.main
      }))
      await route.fulfill({ response, json })
      return
    }

    await route.fulfill({ response })
  })
}
