import { test, expect } from '@playwright/test'
import { sunPosition, moonPosition, toScenePosition } from '../../src/utils/celestialPosition.js'

/**
 * Pure astronomy, no page needed.
 *
 * The anchors are facts that can be checked by hand: at solar noon on a
 * solstice the sun's elevation is 90° minus the difference between the
 * observer's latitude and the sun's declination (±23.44°), and it stands due
 * south for a northern observer.
 */
test.describe('Solar position', () => {
  test('matches the solstice geometry at solar noon in New York', () => {
    // 21 Dec 2026, 11:54 EST — solar noon.
    const winter = sunPosition(new Date('2026-12-21T16:54:00Z'), 40.71, -74.01)
    expect(winter.altitude).toBeCloseTo(90 - 40.71 - 23.44, 0)
    expect(winter.azimuth).toBeGreaterThan(175)
    expect(winter.azimuth).toBeLessThan(185)

    // 21 Jun 2026, 12:57 EDT — solar noon.
    const summer = sunPosition(new Date('2026-06-21T16:57:00Z'), 40.71, -74.01)
    expect(summer.altitude).toBeCloseTo(90 - 40.71 + 23.44, 0)
    expect(summer.azimuth).toBeGreaterThan(175)
    expect(summer.azimuth).toBeLessThan(185)
  })

  test('puts the sun below the horizon at local midnight', () => {
    const midnight = sunPosition(new Date('2026-06-21T04:00:00Z'), 40.71, -74.01)
    expect(midnight.altitude).toBeLessThan(0)
  })

  test('puts the midday sun in the north for a southern city', () => {
    // Sydney, 15 Jan 2026 at local solar noon — the sun passes north of
    // overhead, which a fixed-arc model gets backwards.
    const sydney = sunPosition(new Date('2026-01-15T01:50:00Z'), -33.87, 151.21)
    expect(sydney.altitude).toBeGreaterThan(70)
    const northerly = sydney.azimuth > 330 || sydney.azimuth < 30
    expect(northerly).toBe(true)
  })

  test('barely lifts the sun above the horizon in Reykjavik at midwinter', () => {
    const reykjavik = sunPosition(new Date('2026-12-21T13:20:00Z'), 64.15, -21.94)
    expect(reykjavik.altitude).toBeGreaterThan(0)
    expect(reykjavik.altitude).toBeLessThan(5)
  })
})

test.describe('Lunar position', () => {
  test('returns a bearing and an altitude in range', () => {
    const moon = moonPosition(new Date('2026-06-21T04:00:00Z'), 40.71, -74.01)
    expect(moon.azimuth).toBeGreaterThanOrEqual(0)
    expect(moon.azimuth).toBeLessThan(360)
    expect(moon.altitude).toBeGreaterThan(-90)
    expect(moon.altitude).toBeLessThan(90)
  })
})

test.describe('Scene mapping', () => {
  test('sends north to -Z and east to +X', () => {
    const [nx, , nz] = toScenePosition({ azimuth: 0, altitude: 0 }, 10)
    expect(nx).toBeCloseTo(0, 5)
    expect(nz).toBeCloseTo(-10, 5)

    const [ex, , ez] = toScenePosition({ azimuth: 90, altitude: 0 }, 10)
    expect(ex).toBeCloseTo(10, 5)
    expect(ez).toBeCloseTo(0, 5)
  })

  test('lifts the body with altitude', () => {
    const [, y] = toScenePosition({ azimuth: 180, altitude: 90 }, 10)
    expect(y).toBeCloseTo(10, 5)
  })
})
