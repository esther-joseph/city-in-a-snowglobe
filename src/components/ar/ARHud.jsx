import React from 'react'
import PropTypes from 'prop-types'

/**
 * The AR heads-up display.
 *
 * What was here before was a row of loose black pills along the bottom of the
 * screen and, separately, the app's ordinary drawer handle up in the corner —
 * two unrelated pieces of furniture sharing a window. In AR the page is not a
 * page: it is a sheet of glass held up in front of a room, and everything
 * drawn on it wants to read as one instrument rather than as controls that
 * happen to be floating there.
 *
 * So it is two rails, top and bottom, in the same smoked glass, holding
 * everything: what the weather is doing on one, where to stand and how to
 * leave on the other, and the drawer's handle at the left of the top rail,
 * where a HUD would put a menu. The drawer itself slides out under the rail
 * and is the same glass, so opening it extends the HUD instead of covering
 * it.
 *
 * Nothing here takes the pointer except the things worth pressing. Everything
 * else is see-through, because most of this screen is the room.
 */

/** Smoked glass, the surface every part of the HUD is cut from. */
const RAIL = {
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '7px',
  background: 'linear-gradient(180deg, rgba(32,36,46,0.82) 0%, rgba(0,0,0,0.86) 100%)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '999px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
}

/** A control on a rail: no chrome of its own, since the rail is the chrome. */
const KEY = {
  pointerEvents: 'auto',
  appearance: 'none',
  padding: '10px 16px',
  background: 'transparent',
  color: 'rgba(255,255,255,0.86)',
  border: '1px solid transparent',
  borderRadius: '999px',
  fontSize: '14px',
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  cursor: 'pointer'
}

/** Where you are standing, in the amber the rest of the app uses for that. */
const KEY_ON = {
  ...KEY,
  background: 'rgba(240,191,85,0.16)',
  border: '1px solid rgba(240,191,85,0.85)',
  color: '#f0bf55'
}

/** Leaving is set apart from going somewhere, by a hairline and by colour. */
const KEY_OUT = {
  ...KEY,
  color: 'rgba(255,255,255,0.62)',
  borderLeft: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '0 999px 999px 0',
  paddingLeft: '18px'
}

function ARHud({
  city,
  temperature,
  condition,
  spots,
  activeSpot,
  onSelectSpot,
  onExit,
  onRecenter,
  drawerOpen,
  onToggleDrawer,
  showHint
}) {
  return (
    <div
      data-testid="ar-hud"
      style={{
        position: 'fixed',
        inset: 0,
        // The room shows through the HUD everywhere the HUD is not.
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        zIndex: 120
      }}
    >
      {/* The top rail: the way in to the drawer, and what the weather is. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 12px 0'
        }}
      >
        <div style={{ ...RAIL, maxWidth: 'calc(100vw - 24px)' }}>
          <button
            type="button"
            onClick={onToggleDrawer}
            aria-expanded={drawerOpen}
            aria-label={drawerOpen ? 'Close weather info' : 'Open weather info'}
            data-testid="ar-hud-drawer"
            style={{
              ...(drawerOpen ? KEY_ON : KEY),
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px'
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
              style={{
                transform: drawerOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform 200ms'
              }}
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Weather
          </button>

          {/* The readout. A HUD that tells you nothing is a remote control. */}
          {city && (
            <span
              data-testid="ar-hud-readout"
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                padding: '0 14px 0 6px',
                minWidth: 0,
                color: 'rgba(255,255,255,0.86)',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {city}
              </span>
              {temperature !== null && temperature !== undefined && (
                <span style={{ color: '#f0bf55' }}>{Math.round(temperature)}°</span>
              )}
              {condition && (
                <span
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {condition}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* The bottom rail: where a thumb is, and where a thumb stays when the
          phone is turned. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          padding: '0 12px calc(env(safe-area-inset-bottom, 0px) + 14px)'
        }}
      >
        {/* Said once, and only until it has been taken: a hint that stays up
            after it has been acted on is a label. */}
        {showHint && (
          <span
            data-testid="ar-gesture-hint"
            style={{
              color: 'rgba(255,255,255,0.72)',
              fontSize: '13px',
              textShadow: '0 2px 8px rgba(0,0,0,0.85)'
            }}
          >
            Drag to turn · pinch to resize
          </span>
        )}

        <div
          data-testid="ar-controls"
          style={{ ...RAIL, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 'calc(100vw - 24px)' }}
        >
          {spots.map((spot) => {
            const here = activeSpot === spot.id
            return (
              <button
                type="button"
                key={spot.id}
                onClick={() => onSelectSpot(spot.id)}
                aria-pressed={here}
                data-testid={`ar-go-${spot.id}`}
                style={here ? KEY_ON : KEY}
              >
                {spot.label}
              </button>
            )
          })}

          {onRecenter && (
            <button
              type="button"
              onClick={onRecenter}
              style={KEY}
              aria-label="Rotate the globe into view"
            >
              ↻ Recenter
            </button>
          )}

          <button type="button" onClick={onExit} style={KEY_OUT} data-testid="ar-exit">
            ✕ Exit AR
          </button>
        </div>
      </div>
    </div>
  )
}

ARHud.propTypes = {
  city: PropTypes.string,
  temperature: PropTypes.number,
  condition: PropTypes.string,
  spots: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string.isRequired })
  ),
  activeSpot: PropTypes.string,
  onSelectSpot: PropTypes.func,
  onExit: PropTypes.func.isRequired,
  onRecenter: PropTypes.func,
  drawerOpen: PropTypes.bool,
  onToggleDrawer: PropTypes.func.isRequired,
  showHint: PropTypes.bool
}

ARHud.defaultProps = {
  spots: [],
  onSelectSpot: () => {}
}

export default ARHud
