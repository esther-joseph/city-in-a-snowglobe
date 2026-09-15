import { test, expect } from '@playwright/test'
import { getSeason, seasonForMonth, SEASONS } from '../../src/utils/seasons.js'

/**
 * Season resolution is pure logic, so these run without a page.
 *
 * The cases that matter are the ones where a naive implementation goes wrong:
 * the southern hemisphere, and cities whose local date has already rolled into
 * the next month while UTC has not.
 */
const observation = (iso, latitude, utcOffsetHours) => ({
  dt: Math.floor(Date.parse(iso) / 1000),
  timezone: utcOffsetHours * 3600,
  coord: { lat: latitude }
})

test.describe('Season resolution', () => {
  test('follows the northern hemisphere calendar', () => {
    expect(getSeason(observation('2026-12-05T18:00:00Z', 40.71, -5))).toBe(SEASONS.WINTER)
    expect(getSeason(observation('2026-04-10T12:00:00Z', 51.51, 1))).toBe(SEASONS.SPRING)
    expect(getSeason(observation('2026-07-15T12:00:00Z', 59.91, 2))).toBe(SEASONS.SUMMER)
    expect(getSeason(observation('2026-10-02T12:00:00Z', 45.42, -4))).toBe(SEASONS.AUTUMN)
  })

  test('flips below the equator', () => {
    expect(getSeason(observation('2026-01-15T02:00:00Z', -33.87, 11))).toBe(SEASONS.SUMMER)
    expect(getSeason(observation('2026-07-15T02:00:00Z', -33.87, 10))).toBe(SEASONS.WINTER)
    expect(getSeason(observation('2026-04-10T12:00:00Z', -34.6, -3))).toBe(SEASONS.AUTUMN)
    expect(getSeason(observation('2026-10-02T12:00:00Z', -33.92, 2))).toBe(SEASONS.SPRING)
  })

  test('uses the city local date, not UTC', () => {
    // 23:00 UTC on 28 February is already 12:00 on 1 March in Auckland, which
    // in the southern hemisphere means autumn rather than summer.
    expect(getSeason(observation('2026-02-28T23:00:00Z', -36.85, 13))).toBe(SEASONS.AUTUMN)
    // The mirror case: 02:00 UTC on 1 March is still 21:00 on 28 February in
    // New York, so winter has not ended there yet.
    expect(getSeason(observation('2026-03-01T02:00:00Z', 40.71, -5))).toBe(SEASONS.WINTER)
  })

  test('keeps equatorial cities green year round', () => {
    for (const month of [0, 3, 6, 9]) {
      expect(seasonForMonth(month, -0.18)).toBe(SEASONS.SUMMER) // Quito
      expect(seasonForMonth(month, 1.35)).toBe(SEASONS.SUMMER) // Singapore
    }
    // Just outside the tropical band, seasons apply again.
    expect(seasonForMonth(0, 25.2)).toBe(SEASONS.WINTER)
    expect(seasonForMonth(0, -25.7)).toBe(SEASONS.SUMMER)
  })

  test('falls back to the viewer calendar without weather data', () => {
    expect(Object.values(SEASONS)).toContain(getSeason(null))
  })
})
