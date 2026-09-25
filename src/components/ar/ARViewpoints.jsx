import React from 'react'
import PropTypes from 'prop-types'
import { AR_VIEWS, getViewpoints } from '../../utils/arViewpoints'
import './ARViewpoints.css'

/**
 * Where to stand, while AR is running.
 *
 * Two ways of looking at the globe, and inside the second one, three places to
 * stand. It lives at the foot of the side panel with the other mode controls,
 * because that is where someone already went to turn AR on.
 */
function ARViewpoints({ view = AR_VIEWS.OBSERVATIONAL, spot = 'fountain', onViewChange, onSpotChange }) {
  const viewpoints = getViewpoints()
  const immersive = view === AR_VIEWS.IMMERSIVE

  return (
    <section className="ar-viewpoints" data-testid="ar-viewpoints">
      <header className="ar-viewpoints__header">
        <h3>Point of View</h3>
        <p>Hold the globe at arm&rsquo;s length, or stand inside it.</p>
      </header>

      <div className="ar-viewpoints__modes" role="group" aria-label="Point of view">
        <button
          type="button"
          className={`ar-viewpoints__mode${!immersive ? ' active' : ''}`}
          aria-pressed={!immersive}
          onClick={() => onViewChange?.(AR_VIEWS.OBSERVATIONAL)}
          data-testid="ar-view-observational"
        >
          <span className="ar-viewpoints__mode-label">Observational</span>
          <span className="ar-viewpoints__mode-note">
            The globe on a surface, the size it would really be.
          </span>
        </button>
        <button
          type="button"
          className={`ar-viewpoints__mode${immersive ? ' active' : ''}`}
          aria-pressed={immersive}
          onClick={() => onViewChange?.(AR_VIEWS.IMMERSIVE)}
          data-testid="ar-view-immersive"
        >
          <span className="ar-viewpoints__mode-label">Immersive</span>
          <span className="ar-viewpoints__mode-note">
            Inside the park, at the city&rsquo;s own scale.
          </span>
        </button>
      </div>

      {/* The spots only mean anything once you are inside, so they only appear
          then rather than sitting there greyed out. */}
      {immersive && (
        <div className="ar-viewpoints__spots" data-testid="ar-viewpoint-spots">
          {viewpoints.map((viewpoint) => (
            <button
              key={viewpoint.id}
              type="button"
              className={`ar-viewpoints__spot${spot === viewpoint.id ? ' active' : ''}`}
              aria-pressed={spot === viewpoint.id}
              onClick={() => onSpotChange?.(viewpoint.id)}
              data-testid={`ar-spot-${viewpoint.id}`}
            >
              <span className="ar-viewpoints__spot-label">{viewpoint.label}</span>
              <span className="ar-viewpoints__spot-note">{viewpoint.blurb}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

ARViewpoints.propTypes = {
  view: PropTypes.oneOf([AR_VIEWS.OBSERVATIONAL, AR_VIEWS.IMMERSIVE]),
  spot: PropTypes.string,
  onViewChange: PropTypes.func,
  onSpotChange: PropTypes.func
}

export default ARViewpoints
