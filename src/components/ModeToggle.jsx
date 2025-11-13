import React from 'react'
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
  return (
    <section className="mode-toggle">
      <header className="mode-toggle__header">
        <h3>View Mode</h3>
        <p>Switch between the standard 3D scene and augmented reality.</p>
      </header>
      <div className="mode-toggle__options">
        {VIEW_OPTIONS.map((option) => {
          const isActive = option.id === mode
          return (
            <button
              key={option.id}
              type="button"
              className={isActive ? 'mode-toggle__button active' : 'mode-toggle__button'}
              aria-pressed={isActive}
              onClick={() => onChange?.(option.id)}
            >
              <span className="mode-toggle__label">{option.label}</span>
              <span className="mode-toggle__description">{option.description}</span>
            </button>
          )
        })}
      </div>
      <footer className="mode-toggle__footnote">
        AR mode requires camera permission and works best in a well-lit, open area.
      </footer>
    </section>
  )
}

ModeToggle.propTypes = {
  mode: PropTypes.oneOf(['3d', 'ar']),
  onChange: PropTypes.func
}

export default ModeToggle


