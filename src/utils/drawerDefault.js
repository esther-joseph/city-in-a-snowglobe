/**
 * Whether the weather panel is already out when the app opens.
 *
 * It used to be closed everywhere, and that left the landing screen as a
 * canvas with a menu button on it: nothing to read, which is the whole of
 * what AdSense objected to, and nothing to tell a first-time visitor that the
 * forecast is in there at all. Open, the screen is the readings, the hourly
 * and weekly forecast, the UV and the sun's path, with the globe beside them.
 *
 * Beside them is the condition. The panel is `w-full max-w-md`: on a desktop
 * that is a 448px column with the globe alongside it, and on a phone it is
 * the entire screen, so opening it by default there would hide the thing
 * somebody came to look at behind a wall of numbers — and a full-screen panel
 * carrying advertising that appears without being asked for is close enough
 * to an interstitial to be worth not arguing about. So: wide screens only.
 *
 * `?panel=open` still forces it open anywhere, which is what the manifest's
 * "Change city" shortcut uses.
 */

/**
 * The width at which the panel and the globe can be on screen together.
 *
 * The panel maxes out at 448px and wants a comfortable margin beside it
 * before the globe is worth looking at; 768 is also where Tailwind's `md`
 * breakpoint sits, so the rest of the layout is already changing here.
 */
export const SIDE_BY_SIDE_WIDTH = 768

/**
 * @param {{ panelOpen?: boolean }} [launch] - The parsed launch parameters.
 * @param {number} [width] - Viewport width; injectable for the tests.
 * @returns {boolean}
 */
export function drawerOpensOnLoad(launch = {}, width = undefined) {
  if (launch.panelOpen) return true

  const measured =
    width ?? (typeof window === 'undefined' ? 0 : window.innerWidth || 0)
  return measured >= SIDE_BY_SIDE_WIDTH
}
