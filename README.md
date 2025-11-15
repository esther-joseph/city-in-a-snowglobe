# 3D Weather City Visualization

An interactive snow-globe city that visualizes real-time weather data from OpenWeatherMap using React, React-Three-Fiber, and @react-three/xr.

## Features

- **Procedural Snow-Globe City** – Landmark-aware buildings, vegetation ring, bridges, benches, fountain, and plaques inside a glass globe
- **Live Weather Sync** – Current, hourly, and weekly data sourced via a SOLID-compliant WeatherService using `OPENWEATHER_API_KEY`
- **Rich Weather Effects** – Rain, snow, cloud layers, stellated starfield, moon phases, and emoji-style ⚡ thunderbolts that can be manually toggled for testing
- **Sun & Moon Timeline** – 12-hour slider that updates temperatures, icons, and star/sun positions in real time
- **Shakeable Globe** – Dedicated “Shake Snow Globe” button (and device motion on mobile) to spin particles and rotation with responsive positioning
- **Weather Drawer UI** – Tailwind-inspired drawer containing view toggles (Minimal / Compact / Informational), sun-position diagram, metrics grid, pollen/UV indices, thunder/snow debug toggles, and city search with autocomplete
- **3D & AR Modes** – Switch between the default 3D canvas and an AR view powered by `@react-three/xr` (transparent background, re-instantiating sessions for stability)
- **Dynamic Glass Tinting** – Snow-globe glass tint, fogging, and aura colors adapt to time of day and weather conditions
- **Interactive Controls** – OrbitControls for rotate/pan/zoom plus mobile-friendly layout adjustments
- **Vercel Ready** – Uses `OPENWEATHER_API_KEY` env variable only (no inline entry) and includes `vercel.json`

## Documentation Highlights

This README intentionally covers the most common needs when onboarding to the project:

1. **Run the project locally & mirror the dev environment**  
   - See _Setup Instructions_ (API key creation, dependency install, `npm run dev`, and `.env` usage) plus the _Deploy to Vercel_ and _Preview Production Build_ sections for parity with hosted environments.

2. **Navigate the core prototype interactions**  
   - The _Usage_ and _Weather Effects_ sections walk through the drawer UI, search/autocomplete, view toggles, time slider, shake mode, and weather overrides so testers know how to explore the experience.

3. **Understand third-party APIs & libraries**  
   - _Technologies Used_ lists every major dependency (React, R3F, drei, XR, OpenWeatherMap, Vite) along with why they’re included (3D rendering, AR mode, weather data, build tooling).

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
7. **3D vs AR** – Use the Mode toggle at the bottom of the drawer to swap between 3D canvas (with aura sky / starfield) and AR (transparent background, reloaded session for performance).
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
│   │   ├── ModeToggle.jsx          # 3D / AR switcher
│   │   └── city/*, environment/*   # Fountain, vegetation ring, sun/moon, etc.
│   ├── services/WeatherService.js  # CRUD wrapper for OpenWeatherMap APIs
│   ├── App.jsx                     # Main scene + Canvas/XR + shake button
│   ├── App.css                     # Global styles / layout helpers
│   └── main.jsx                    # Entry point
├── index.html                 # HTML template
├── vite.config.js            # Vite configuration
└── package.json              # Dependencies
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

**City Not Found?**
- Try different spelling or add country code (e.g., "London, GB")
- Use major city names

## License

MIT - Feel free to use this project however you like!

## Credits

Built with ❤️ using React-Three-Fiber and OpenWeatherMap API
