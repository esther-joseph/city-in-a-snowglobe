import React, { useState } from 'react'
import WeatherUI from './WeatherUI'
import ModeToggle from './ModeToggle'

function WeatherDrawer({
  weatherData,
  hourlyForecast,
  weeklyForecast,
  uvIndex,
  celestialData,
  loading,
  error,
  onSearch,
  currentCity,
  onTimeAdjust,
  timeOverride,
  displayHour,
  onThunderToggle,
  forceThunder,
  onSnowToggle,
  forceSnow,
  onRainToggle,
  forceRain,
  particleValidation,
  renderMode,
  onRenderModeChange,
  weatherService
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Toggle Button - Always visible, even in AR mode */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-[100] bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-lg shadow-lg hover:bg-black/90 transition-all duration-200 flex items-center gap-2 border border-white/10"
        aria-label={isOpen ? "Close Weather Info" : "Open Weather Info"}
        style={{ 
          pointerEvents: 'auto',
          zIndex: 1000
        }}
      >
        <svg
          className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="font-medium">{isOpen ? 'Close Weather Info' : 'Open Weather Info'}</span>
      </button>

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-full max-w-md bg-black/30 backdrop-blur-xl z-[90] transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          boxShadow: isOpen ? '4px 0 24px rgba(0, 0, 0, 0.5)' : 'none',
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
      >
        <div className="pt-20 px-6 pb-6 flex flex-col gap-5">
          {/* Weather UI Components */}
          <WeatherUI
            weatherData={weatherData}
            hourlyForecast={hourlyForecast}
            weeklyForecast={weeklyForecast}
            uvIndex={uvIndex}
            celestialData={celestialData}
            loading={loading}
            error={error}
            onSearch={onSearch}
            currentCity={currentCity}
            onTimeAdjust={onTimeAdjust}
            timeOverride={timeOverride}
            displayHour={displayHour}
            onThunderToggle={onThunderToggle}
            forceThunder={forceThunder}
            onSnowToggle={onSnowToggle}
            forceSnow={forceSnow}
          onRainToggle={onRainToggle}
          forceRain={forceRain}
          particleValidation={particleValidation}
            weatherService={weatherService}
          />
          <ModeToggle 
            mode={renderMode} 
            onChange={(newMode) => {
              onRenderModeChange?.(newMode)
              setIsOpen(false)
            }} 
          />
        </div>
      </div>
    </>
  )
}

export default WeatherDrawer

