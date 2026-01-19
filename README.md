# City In A Snowglobe


An interactive snow-globe city that visualizes real-time weather data from OpenWeatherMap using React, React-Three-Fiber, and @react-three/xr.

## Features

- 🏙️ **Procedural Snow-Globe City** – Landmark-aware buildings, vegetation ring, bridges, benches, fountain, and plaques inside a glass globe
- 🌦️ **Live Weather Sync** – Current, hourly, and weekly data sourced via a SOLID-compliant WeatherService using `OPENWEATHER_API_KEY`
- 🌩️ **Rich Weather Effects** – Rain, snow, cloud layers, stellated starfield, moon phases, and emoji-style ⚡ thunderbolts that can be manually toggled for testing
- 🔆 **Sun & Moon Timeline** – 12-hour slider that updates temperatures, icons, and star/sun positions in real time
- ✨ **Shakeable Globe** – Dedicated “Shake Snow Globe” button (and device motion on mobile) to spin particles and rotation with responsive positioning
- 🗂️ **Weather Drawer UI** – Tailwind-inspired drawer containing view toggles (Minimal / Compact / Informational), sun-position diagram, metrics grid, pollen/UV indices, thunder/snow debug toggles, and city search with autocomplete
- 📱 **3D & AR Modes** – Switch between the default 3D canvas and an AR view powered by `@react-three/xr` (transparent background, re-instantiating sessions for stability)
- 🌁 **Dynamic Glass Tinting** – Snow-globe glass tint, fogging, and aura colors adapt to time of day and weather conditions
- 🖱️ **Interactive Controls** – OrbitControls for rotate/pan/zoom plus mobile-friendly layout adjustments
- ✅ **Vercel Ready** – Uses `OPENWEATHER_API_KEY` env variable only (no inline entry) and includes `vercel.json`

## Documentation

### Getting Started
- **Setup Instructions** – API key creation, dependency install, `npm run dev`, and `.env` usage
- **Usage Guide** – Walkthrough of drawer UI, search, view modes, timeline, shake mode, and weather effects
- **Technologies** – Complete list of dependencies and their purposes

### Platform-Specific Guides
- **[Android Release Guide](docs/android/README.md)** – Complete guide for building and releasing to Google Play Store
  - Getting started with Capacitor
  - Build commands and signing setup
  - Play Store submission checklist
- **[iOS AR Setup](docs/ios-ar-setup.md)** – iOS AR mode configuration and troubleshooting
  - iOS 17+ WebXR support
  - Camera permission handling
  - Device compatibility

### Development & Polish
- **[Game-Feel Audit](docs/game-feel/GAME_FEEL_AUDIT.md)** – Comprehensive game-feel polish guide
  - Animation improvements
  - Particle system refinements
  - Perceived performance optimizations
  - Optional delight features

## Setup Instructions

### 1. Get Your OpenWeatherMap API Key

1. Visit [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for a free account
3. Generate an API key (it may take a few minutes to activate)

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

The app runs at `http://localhost:5173` by default (Vite).

### 4. Set Up API Key

**Option A: Environment Variable (Required for Vercel)**
1. Create a `.env` file in the root directory
2. Add: `OPENWEATHER_API_KEY=your_api_key_here`
3. For Vercel: Set `OPENWEATHER_API_KEY` in your Vercel project settings under Environment Variables

**Note:** The API key must be set as an environment variable. The UI no longer exposes direct entry.

## Usage

1. **Open the Weather Drawer** – Tap “Open Weather Info” to reveal the stacked UI (search, metrics, timeline, view modes, thunder/snow toggles, sun-position diagram).
2. **Search for Cities** – Type in the drawer search bar. Suggestions float above other UI with city/state/country metadata. Clearing text uses the “×” button.
3. **Change View Modes** – Minimal, Compact, or Informational layouts change icon size, metric grids, and extra cards (e.g., sun position diagram only in Informational).
4. **Time Slider** – Drag the 12-hour slider to update the main temperature readout, graph, weather icons, and sun/moon positions. Sunrise/sunset labels update per-city/time zone.
5. **Thunder/Snow Testing** – In the drawer header, tap the highlighted toggles to override weather data and preview thunder or snow particle systems.
6. **Shake the Globe** – Press the floating “✨ Shake Snow Globe” button (always within viewport thanks to responsive clamps) or shake a physical device with motion permissions granted.
7. **3D vs AR** – Use the Mode toggle at the bottom of the drawer to swap between 3D canvas (with aura sky / starfield) and AR (transparent background, reloaded session for performance). AR mode requires iOS 17+ or Android device with WebXR support and camera permission. The toggle automatically disables if AR is not supported on your device.
8. **Scene Controls** – Outside the drawer, left-drag to rotate, right-drag to pan, scroll/pinch to zoom.

## Weather Effects

- ☀️ **Clear** – Sunny lighting, reflective windows, raised sun arc, translucent glass tint
- ☁️ **Clouds** – Procedural cloud layer inside the globe (day & night) with density tied to API coverage and weather type
- 🌧️ **Rain** – Teardrop instanced particles scaled to dome size with cloud umbrellas overhead
- ❄️ **Snow** – Expanded snow particle volume matching cloud scale plus manual override toggle
- ⚡ **Thunder** – Emoji-style thunderbolts spawning with random flashing, density matching snow, override toggle available
- 🌫️ **Fog / Mist** – Increased glass roughness/tint, aura adjustments, subdued lighting
- ✨ **Stars & Moon** – Stellation-based starfield and moon phase indicators when night mode or manual override applies

## Technologies Used

- **React** - UI framework
- **Three.js** - 3D rendering engine
- **React-Three-Fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for R3F
- **@react-three/xr** - AR session support
- **OpenWeatherMap API** - Weather data
- **Vite** - Fast build tool

## Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add environment variable:
   - Go to Project Settings → Environment Variables
   - Add `OPENWEATHER_API_KEY` with your OpenWeatherMap API key
4. Deploy!

The app will automatically build and deploy. The `vercel.json` file is configured for Vite.

## Build for Production

```bash
npm run build
```

The optimized production build will be in the `dist` folder.

## Preview Production Build

```bash
npm run preview
```

## Project Structure

```
weather-city-3d/
├── src/
│   ├── components/
│   │   ├── City.jsx                # 3D snow-globe, bridges, landmarks
│   │   ├── WeatherEffects.jsx      # Rain, snow, thunder, clouds, stars
│   │   ├── WeatherDrawer.jsx       # Drawer shell with toggle button
│   │   ├── WeatherUI.jsx / .css    # Drawer content, graphs, metrics, toggles
│   │   ├── ModeToggle.jsx          # 3D / AR switcher (with device detection)
│   │   └── city/*, environment/*   # Fountain, vegetation ring, sun/moon, etc.
│   ├── services/WeatherService.js  # CRUD wrapper for OpenWeatherMap APIs
│   ├── utils/
│   │   └── arSupport.js            # AR capability detection (iOS/Android)
│   ├── App.jsx                     # Main scene + Canvas/XR + shake button
│   ├── App.css                     # Global styles / layout helpers
│   └── main.jsx                    # Entry point
├── docs/
│   ├── android/                    # Android release documentation
│   ├── game-feel/                  # Game-feel polish guide
│   └── ios-ar-setup.md             # iOS AR mode guide
├── index.html                      # HTML template (with iOS meta tags)
├── vite.config.js                  # Vite configuration
├── capacitor.config.js             # Capacitor configuration (iOS/Android)
└── package.json                    # Dependencies
```

## Platform Support

### Web (Desktop & Mobile)
- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ WebGL 2.0 required for 3D rendering
- ✅ Responsive design for mobile browsers

### AR Mode Requirements
- **iOS**: iOS 17+ with Safari browser, camera permission
- **Android**: WebXR-compatible browser (Chrome recommended), camera permission
- **Desktop**: Limited AR support (depends on WebXR availability)

See [iOS AR Setup Guide](docs/ios-ar-setup.md) for detailed iOS requirements.

### Mobile App (Capacitor)
- ✅ **Android**: Full support with Capacitor wrapper (see [Android Release Guide](docs/android/README.md))
- ✅ **iOS**: Capacitor support available, AR requires iOS 17+ for WebXR

## Development Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Android (requires Capacitor setup)
npm run android:sync     # Build web app and sync to Android
npm run android:open     # Open Android project in Android Studio
npm run android:build    # Build release APK
npm run android:bundle   # Build release AAB for Play Store
```

## API Rate Limits

The free OpenWeatherMap API tier includes:
- 60 calls/minute
- 1,000,000 calls/month

This is more than enough for personal use!

## Troubleshooting

**API Key Not Working?**
- Make sure your API key is activated (can take 10-20 minutes after creation)
- Check that you've entered it correctly without spaces
- Verify your internet connection

**3D Scene Not Loading?**
- Ensure your browser supports WebGL
- Try a different browser (Chrome, Firefox, Edge recommended)
- Check browser console for errors

**AR Mode Not Working?**
- **iOS**: Requires iOS 17+ and Safari browser. Camera permission must be granted. See [iOS AR Setup Guide](docs/ios-ar-setup.md)
- **Android**: Requires WebXR-compatible browser (Chrome recommended) and camera permission
- Ensure you're on a physical device (simulators don't support AR)
- Check that AR button is enabled (it will be disabled if not supported)

**City Not Found?**
- Try different spelling or add country code (e.g., "London, GB")
- Use major city names

## License

MIT - Feel free to use this project however you like!

## Additional Resources

- **[Game-Feel Audit](docs/game-feel/GAME_FEEL_AUDIT.md)** – Animation polish, particle refinement, and performance optimizations
- **[Android Release Guide](docs/android/README.md)** – Complete Play Store submission guide
- **[iOS AR Setup](docs/ios-ar-setup.md)** – iOS AR mode configuration

## Credits

Built with ❤️ using React-Three-Fiber and OpenWeatherMap API

### Special Thanks
- OpenWeatherMap for weather data API
- Three.js community for amazing 3D tools
- React Three Fiber team for the excellent React renderer
