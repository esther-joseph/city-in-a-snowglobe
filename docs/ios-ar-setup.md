# AR on Apple platforms

## What Safari actually supports

| Platform | `immersive-ar` WebXR session | What the app does |
| --- | --- | --- |
| iPhone / iPad (any iOS version) | **No** | USDZ export → AR Quick Look, or the camera fallback |
| Safari on visionOS | **Yes** (default from visionOS 2; flag in 1.x) | Same WebXR path as Android |
| Android Chrome (ARCore) | Yes | WebXR |
| Android XR headsets | Yes | WebXR |
| Capacitor WKWebView (iOS app) | **No** | Quick Look or camera fallback |

Earlier revisions of this document claimed iOS 17+ Safari supports WebXR. It
does not, and never has. Apple shipped the WebXR Device API on visionOS only;
the feature flags in iOS Safari's advanced settings do not produce a working
`immersive-ar` session. `navigator.xr.isSessionSupported('immersive-ar')`
resolves false on iPhone and iPad, which is why the app stopped asking about
iOS versions and now asks the device what it can do.

## The three paths

`src/utils/arSupport.js` resolves one of four modes, capability-first:

- **`webxr`**, an immersive session through `@react-three/xr`. ARCore phones,
  Android XR headsets, and Safari on visionOS all land here.
- **`quicklook`**, iPhone and iPad. `src/utils/usdzExport.js` converts the
  globe to USDZ and hands it to Apple's AR Quick Look, which does real plane
  detection and placement. The app itself stays in 3D mode.
- **`camera`**, rear camera feed plus device orientation. No world tracking:
  the globe follows the device rather than staying on a surface.
- **`none`**, desktops. The AR button is disabled with an explanation.

## USDZ export limits

USDZ stores its payload uncompressed, so every vertex costs roughly a hundred
bytes of ASCII in the archive. The full city is ~220k vertices across ~3,700
meshes, which exports at about 30 MB, too heavy for Quick Look on a phone.

The exporter therefore:

- ranks meshes by world-space volume and keeps the largest until a 60k vertex
  budget is spent, which preserves the dome, base and towers while dropping
  window trim and small props;
- merges the survivors by material appearance rather than material identity
  (the city gives almost every mesh its own material instance);
- keeps only position and normal attributes, since no material samples a
  texture;
- approximates custom shaders, including the fresnel glass dome, with
  `MeshStandardMaterial`, and drops particle systems and Troika text outright,
  because USD has no equivalent for any of them.

Result: roughly 5-6 MB and under half a second to build on a modern phone.
The exported globe is recognisably the same object, minus falling snow and the
engraved city name.

## visionOS

The WebXR path should work as-is in Safari on visionOS, but two things differ
from Android and want testing on a real device:

- **No DOM overlay.** `dom-overlay` is an ARCore extension; headset browsers do
  not composite HTML into an immersive session. Without in-scene UI the session
  has no controls at all, which is why `src/components/ar/ARSceneControls.jsx`
  renders Shake and Exit as 3D objects inside the scene.
- **Gaze and pinch, not taps.** visionOS reports a `transient-pointer` input
  source. `@react-three/xr` v6 models it, but the interaction wiring has not
  been verified on hardware.

There is no visionOS simulator on the current build machine; testing needs the
visionOS platform installed in Xcode, or a device.

## Shipping to iOS

The iOS Capacitor platform has not been added yet:

```bash
npx cap add ios
npm run build && npx cap sync ios
npx cap open ios
```

Distribution needs an Apple Developer account. Note that the Capacitor build
gets no WebXR even on visionOS, a "Designed for iPad" app runs as a flat
window. The headset path is the deployed web app opened in Safari.

## Requirements recap

- **Camera permission** for the fallback path (`NSCameraUsageDescription` is
  already set in `capacitor.config.json`).
- **Motion permission**, iOS 13+ gates `deviceorientation` behind a prompt
  that must follow a user gesture; `requestOrientationPermission()` handles it.
- **A physical device.** Neither AR path works in the iOS Simulator.
