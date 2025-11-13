import React, { useState } from 'react'
import WeatherUI from './WeatherUI'
import ModeToggle from './ModeToggle'

function WeatherDrawer({
  weatherData,
  hourlyForecast,
  weeklyForecast,
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
  renderMode,
  onRenderModeChange
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-lg shadow-lg hover:bg-black/90 transition-all duration-200 flex items-center gap-2 border border-white/10"
        aria-label={isOpen ? "Close Weather Info" : "Open Weather Info"}
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

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-full max-w-md bg-black/30 backdrop-blur-xl z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          boxShadow: isOpen ? '4px 0 24px rgba(0, 0, 0, 0.5)' : 'none'
        }}
      >
        <div className="p-6 flex flex-col gap-5">
          {/* Weather UI Components */}
          <div className="mt-4">
            <WeatherUI
            weatherData={weatherData}
            hourlyForecast={hourlyForecast}
            weeklyForecast={weeklyForecast}
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
            />
          </div>
          <ModeToggle mode={renderMode} onChange={onRenderModeChange} />
        </div>
      </div>
    </>
  )
}

export default WeatherDrawer

