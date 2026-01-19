/**
 * AR Support Detection Utilities
 * 
 * Handles device-specific AR capability detection, especially for iOS
 * which has limited WebXR support.
 */

/**
 * Check if device is iOS
 */
export function isIOS() {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * Check iOS version (returns major version number, e.g., 17)
 */
export function getIOSVersion() {
  if (!isIOS()) return null
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Check if device supports ARKit (iOS native AR)
 * Requires iOS 11+ and ARKit-compatible device
 */
export function supportsARKit() {
  if (!isIOS()) return false
  const version = getIOSVersion()
  if (!version || version < 11) return false
  
  // ARKit is supported on:
  // - iPhone 6s and later
  // - iPad (2017) and later
  // - iPad Pro (all models)
  // We can't precisely detect this without native code, so assume modern devices support it
  // Real detection would require Capacitor plugin or User-Agent parsing
  return version >= 11
}

/**
 * Check if WebXR is available (works on iOS 17+ in Safari, but limited)
 */
export function isWebXRAvailable() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return 'xr' in navigator
}

/**
 * Check if WebXR immersive-ar session is supported
 * Returns Promise<boolean>
 */
export async function isWebXRARSupported() {
  if (!isWebXRAvailable()) return false
  
  try {
    if (navigator.xr && typeof navigator.xr.isSessionSupported === 'function') {
      return await navigator.xr.isSessionSupported('immersive-ar')
    }
    return false
  } catch (error) {
    console.warn('WebXR AR support check failed:', error)
    return false
  }
}

/**
 * Get AR capability status
 * Returns object with support information
 */
export async function getARCapability() {
  const ios = isIOS()
  const iosVersion = getIOSVersion()
  const webXRAvailable = isWebXRAvailable()
  const webXRARSupported = webXRAvailable ? await isWebXRARSupported() : false
  const arkitSupported = ios && supportsARKit()
  
  return {
    isIOS: ios,
    iosVersion,
    webXRAvailable,
    webXRARSupported,
    arkitSupported,
    // iOS 17+ has experimental WebXR support in Safari
    // Older iOS versions would need native ARKit plugin
    supported: webXRARSupported || (ios && iosVersion >= 17 && webXRAvailable),
    fallbackAvailable: arkitSupported && !webXRARSupported,
    message: ios && !webXRARSupported && iosVersion < 17
      ? 'AR mode requires iOS 17 or later. Please update your device to use AR features.'
      : ios && !webXRARSupported && iosVersion >= 17
        ? 'AR mode may have limited support. Please ensure you are using Safari or a WebXR-compatible browser.'
        : !webXRARSupported
          ? 'AR mode is not supported on this device.'
          : null
  }
}

/**
 * Request camera permission (for iOS, this may need native handling)
 * Returns Promise<boolean>
 */
export async function requestCameraPermission() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return false
  }
  
  try {
    // This will trigger permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    // Immediately stop the stream (we just needed permission)
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch (error) {
    console.warn('Camera permission denied:', error)
    return false
  }
}

