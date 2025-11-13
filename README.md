# 3D Weather City Visualization

A stunning 3D city landscape that visualizes real-time weather data from OpenWeatherMap API using React-Three-Fiber.

## Features

- 🏙️ **3D City Landscape** - Procedurally generated buildings with realistic lighting
- 🌦️ **Real-Time Weather** - Live data from OpenWeatherMap API
- ⛈️ **Dynamic Weather Effects** - Rain, snow, and cloud particles based on actual weather
- 🌈 **Adaptive Sky** - Sky color changes based on weather conditions
- 🖱️ **Interactive Controls** - Orbit, zoom, and pan around the 3D scene
- 📱 **Responsive Design** - Works on desktop and mobile devices

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

The app will open in your browser at `http://localhost:3000`

### 4. Enter Your API Key

- Click the 🔑 button in the top bar
- Paste your OpenWeatherMap API key
- Your key will be saved locally for future use

## Usage

1. **Search for Cities**: Type any city name in the search bar and press Enter or click the search icon
2. **Navigate the Scene**: 
   - Left click + drag to rotate the camera
   - Scroll to zoom in/out
   - Right click + drag to pan
3. **Watch Weather Effects**: The scene will display rain, snow, or clouds based on the actual weather

## Weather Effects

- ☀️ **Clear** - Bright sky with strong sunlight
- ☁️ **Cloudy** - 3D cloud particles floating above the city
- 🌧️ **Rain** - Particle system simulating falling rain
- ❄️ **Snow** - Gentle snowfall with wind drift
- 🌫️ **Fog/Mist** - Atmospheric conditions

## Technologies Used

- **React** - UI framework
- **Three.js** - 3D rendering engine
- **React-Three-Fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for R3F
- **OpenWeatherMap API** - Weather data
- **Vite** - Fast build tool

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
│   │   ├── City.jsx           # 3D city buildings
│   │   ├── WeatherEffects.jsx # Rain, snow, clouds
│   │   ├── WeatherUI.jsx      # UI overlay
│   │   └── WeatherUI.css      # UI styling
│   ├── App.jsx                # Main application
│   ├── App.css                # Global styles
│   └── main.jsx               # Entry point
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
