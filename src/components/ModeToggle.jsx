import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import './ModeToggle.css'

const VIEW_OPTIONS = [
  {
    id: '3d',
    label: '3D Mode',
    description: 'Interact with the snow globe directly on screen.'
  },
  {
    id: 'ar',
    label: 'AR Mode',
    description: 'Project the globe into your space using your device camera.'
  }
]

function ModeToggle({ mode = '3d', onChange }) {
  const [arSupported, setArSupported] = useState(true)
  const [arMessage, setArMessage] = useState(null)

  useEffect(() => {
    // Check AR support
    import('../utils/arSupport').then(({ getARCapability }) => {
      getARCapability().then((capability) => {
        setArSupported(capability.supported)
        setArMessage(capability.message)
      }).catch(() => {
        setArSupported(true) // Assume supported if check fails
      })
    }).catch(() => {
      setArSupported(true) // Assume supported if module fails to load
    })
  }, [])

  const handleModeChange = (newMode) => {
    if (newMode === 'ar' && !arSupported) {
      // Show message if AR is not supported
      if (arMessage) {
        alert(arMessage)
      }
      return
    }
    onChange?.(newMode)
  }

  return (
    <section className="mode-toggle">
      <header className="mode-toggle__header">
        <h3>View Mode</h3>
        <p>Switch between the standard 3D scene and augmented reality.</p>
      </header>
      <div className="mode-toggle__options">
        {VIEW_OPTIONS.map((option) => {
          const isActive = option.id === mode
          const isARDisabled = option.id === 'ar' && !arSupported
          return (
            <button
              key={option.id}
              type="button"
              className={`mode-toggle__button ${isActive ? 'active' : ''} ${isARDisabled ? 'disabled' : ''}`}
              aria-pressed={isActive}
              aria-disabled={isARDisabled}
              disabled={isARDisabled}
              onClick={() => handleModeChange(option.id)}
            >
              <span className="mode-toggle__label">{option.label}</span>
              <span className="mode-toggle__description">{option.description}</span>
              {isARDisabled && (
                <span className="mode-toggle__unsupported">(Not available on this device)</span>
              )}
            </button>
          )
        })}
      </div>
      <footer className="mode-toggle__footnote">
        {arSupported 
          ? 'AR mode requires camera permission and works best in a well-lit, open area.'
          : 'AR mode is not supported on this device. Please use 3D mode.'}
      </footer>
    </section>
  )
}

ModeToggle.propTypes = {
  mode: PropTypes.oneOf(['3d', 'ar']),
  onChange: PropTypes.func
}

export default ModeToggle


