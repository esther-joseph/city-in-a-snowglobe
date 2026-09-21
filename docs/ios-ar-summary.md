# iOS AR mode, in short

## How it picks a route

Safari on iPhone and iPad has no WebXR `immersive-ar` session, so the Android
AR path cannot run there. The app detects what each device supports and picks
one of three routes:

| Device | Route |
| --- | --- |
| Android (ARCore), Android XR, Safari on visionOS | WebXR session |
| iPhone / iPad | USDZ export → AR Quick Look |
| Other touch devices with a camera | Camera feed + device orientation |
| Desktop | AR disabled, with an explanation |

## Where it lives

- `src/utils/arSupport.js`, capability detection, returns one of
  `webxr` / `quicklook` / `camera` / `none`
- `src/utils/usdzExport.js`, scene → USDZ, sized down for Quick Look
- `src/components/ar/CameraFeedBackground.jsx`, rear camera feed
- `src/components/ar/DeviceOrientationCamera.jsx`, motion-driven camera
- `src/components/ar/FitToMeters.jsx`, scales the scene to real-world size
- `src/components/ar/ARSceneControls.jsx`, in-scene UI for headset sessions
- `src/App.jsx`, `handleRenderModeChange` resolves the route before switching

## Known limitations

- **Quick Look is a still model.** Falling snow, rain and the fresnel glass
  shader have no USD equivalent and are dropped or approximated.
- **The camera fallback has no world tracking.** The globe follows the device
  instead of staying anchored to a surface. Recenter nudges it back into view.
- **visionOS is untested on hardware.** The code path is the WebXR one and
  should work, but gaze-and-pinch input has not been verified on a device.
- **The iOS platform is not added yet.** See `docs/ios-ar-setup.md`.

## Full documentation

See [`docs/ios-ar-setup.md`](./ios-ar-setup.md).
