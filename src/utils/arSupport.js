/**
 * AR capability detection.
 *
 * Detection is capability-first, not platform-first: whatever the device
 * actually implements decides which AR path the app takes.
 *
 *   webxr      immersive-ar sessions. ARCore phones, Android XR headsets and
 *              Safari on visionOS (WebXR is on by default from visionOS 2).
 *   quicklook  iPhone/iPad. Safari has never shipped immersive-ar, so the
 *              globe is exported to USDZ and handed to Apple's AR Quick Look.
 *   camera     Camera feed plus device orientation. No world tracking, so the
 *              globe follows the device instead of staying put.
 *   none       No AR path available (most desktops).
 */

export const AR_MODES = {
  WEBXR: 'webxr',
  QUICK_LOOK: 'quicklook',
  CAMERA: 'camera',
  NONE: 'none'
}

/**
 * iPhone, iPod, and iPad — including iPadOS 13+, which reports a desktop
 * Safari user agent and is only distinguishable by its touch points.
 */
export function isIOSFamily() {
  if (typeof navigator === 'undefined') return false
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return true
  return /Macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) > 1
}

/** Kept for callers that only care about the classic iOS user agents. */
export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Major iOS version, or null when it can't be read from the user agent. */
export function getIOSVersion() {
  if (typeof navigator === 'undefined') return null
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/)
  return match ? parseInt(match[1], 10) : null
}

/** Whether the browser exposes the WebXR Device API at all. */
export function isWebXRAvailable() {
  return typeof navigator !== 'undefined' && 'xr' in navigator
}

/**
 * Whether an immersive-ar session can actually start. This is the only
 * reliable signal — user agent sniffing cannot tell visionOS Safari (which
 * supports it) from iOS Safari (which does not).
 * @returns {Promise<boolean>}
 */
export async function isWebXRARSupported() {
  if (!isWebXRAvailable()) return false
  try {
    return await navigator.xr.isSessionSupported('immersive-ar')
  } catch (error) {
    console.warn('WebXR AR support check failed:', error)
    return false
  }
}

/**
 * Whether Safari will hand a USDZ file to AR Quick Look. The relList check is
 * Apple's documented feature test.
 */
export function supportsQuickLook() {
  if (typeof document === 'undefined') return false
  if (!isIOSFamily()) return false
  const anchor = document.createElement('a')
  return Boolean(anchor.relList && anchor.relList.supports && anchor.relList.supports('ar'))
}

/**
 * Whether the camera fallback can run: a rear camera, motion sensors, and a
 * secure context to ask for them.
 */
export function supportsCameraFallback() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  if (!window.isSecureContext) return false
  if (!navigator.mediaDevices?.getUserMedia) return false
  if (!('DeviceOrientationEvent' in window)) return false
  return (navigator.maxTouchPoints || 0) > 0
}

const MESSAGES = {
  [AR_MODES.WEBXR]: null,
  [AR_MODES.QUICK_LOOK]:
    "Opens the globe in Apple's AR Quick Look. Weather effects and the glass dome are simplified, since USDZ can't carry them.",
  [AR_MODES.CAMERA]:
    'Uses your camera and motion sensors. The globe follows your device rather than staying anchored to a surface.',
  [AR_MODES.NONE]:
    'AR mode needs a phone, tablet, or headset with a camera. Try opening the app on one of those.'
}

const LABELS = {
  [AR_MODES.WEBXR]: 'Place the globe in your room and walk around it.',
  [AR_MODES.QUICK_LOOK]: 'Place the globe on a surface with AR Quick Look.',
  [AR_MODES.CAMERA]: 'Hold the globe up against your camera view.',
  [AR_MODES.NONE]: 'Project the globe into your space using your device camera.'
}

/**
 * Resolve which AR path this device should take.
 * @returns {Promise<{mode: string, supported: boolean, message: string|null,
 *   label: string, webXRARSupported: boolean, quickLookSupported: boolean,
 *   cameraSupported: boolean, isIOSFamily: boolean, iosVersion: number|null}>}
 */
export async function getARCapability() {
  const webXRARSupported = await isWebXRARSupported()
  const quickLookSupported = supportsQuickLook()
  const cameraSupported = supportsCameraFallback()

  let mode = AR_MODES.NONE
  if (webXRARSupported) mode = AR_MODES.WEBXR
  else if (quickLookSupported) mode = AR_MODES.QUICK_LOOK
  else if (cameraSupported) mode = AR_MODES.CAMERA

  return {
    mode,
    supported: mode !== AR_MODES.NONE,
    message: MESSAGES[mode],
    label: LABELS[mode],
    webXRARSupported,
    quickLookSupported,
    cameraSupported,
    isIOSFamily: isIOSFamily(),
    iosVersion: getIOSVersion()
  }
}

/**
 * Ask for the rear camera and release it again — the fallback only needs the
 * permission grant at this point.
 * @returns {Promise<boolean>}
 */
export async function requestCameraPermission() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch (error) {
    console.warn('Camera permission denied:', error)
    return false
  }
}

/**
 * iOS 13+ gates motion events behind a permission prompt that must be
 * triggered by a user gesture. Everywhere else this resolves true.
 * @returns {Promise<boolean>}
 */
export async function requestOrientationPermission() {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false
  const request = window.DeviceOrientationEvent.requestPermission
  if (typeof request !== 'function') return true
  try {
    return (await request()) === 'granted'
  } catch (error) {
    console.warn('Motion permission denied:', error)
    return false
  }
}
