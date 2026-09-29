/**
 * One place that knows what an ad slot is, per platform.
 *
 * The point of the indirection: the web build fills slots with AdSense, and
 * the Play Store build has to fill the same slots with AdMob, because AdSense
 * is a website product and serving it inside a packaged app breaches its
 * policies. Components ask for a slot by name — "drawer-banner" — and never
 * learn which network answered. Swapping in AdMob later is filling in the
 * `native` ids below; no component changes.
 *
 * Ids come from the environment so that a fork, a staging deploy and the store
 * build can each point at their own inventory.
 */

const env = import.meta.env ?? {}

export const AD_CLIENT = env.VITE_ADSENSE_CLIENT || 'ca-pub-4752576373489354'

export const AD_SLOTS = {
  // Under the metrics and the timeline, where the reader has stopped to look
  // at numbers. In-view, never over the globe.
  'drawer-banner': {
    web: {
      slot: env.VITE_ADSENSE_SLOT_DRAWER || null,
      format: 'horizontal',
      minHeight: 90
    },
    native: {
      unit: env.VITE_ADMOB_UNIT_DRAWER || null,
      size: 'BANNER',
      position: 'BOTTOM_CENTER'
    }
  },
  // The foot of the drawer, below the view-mode controls: the end of the
  // scroll, so nothing is pushed out of reach.
  'drawer-footer': {
    web: {
      // The unit from the account that owns AD_CLIENT. Still overridable, so
      // a fork or a staging deploy points at its own inventory rather than
      // billing impressions to this one.
      slot: env.VITE_ADSENSE_SLOT_FOOTER || '8417155376',
      // Responsive: AdSense measures the panel and picks the shape, which is
      // what a column that is 320px wide on a phone and 448px on a tablet
      // needs. A fixed rectangle would letterbox on one of them.
      format: 'auto',
      fullWidthResponsive: true,
      minHeight: 100
    },
    native: {
      unit: env.VITE_ADMOB_UNIT_FOOTER || null,
      size: 'MEDIUM_RECTANGLE',
      position: 'BOTTOM_CENTER'
    }
  }
}

export const AD_SLOT_NAMES = Object.keys(AD_SLOTS)

/**
 * Full-screen ads, which exist in the packaged app and nowhere else.
 *
 * There is no `web` key here and that is the point: AdSense does not permit a
 * publisher-placed interstitial, so there is nothing for the web build to
 * read even by accident. See nativeInterstitial.js.
 */
export const AD_INTERSTITIALS = {
  // On the way out of AR: a break the person chose, with a transition to
  // cover it and no permission waiting on the other side.
  'ar-exit': { native: { unit: env.VITE_ADMOB_UNIT_AR_EXIT || null } }
}
