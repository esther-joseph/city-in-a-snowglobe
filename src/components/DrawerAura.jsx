import React from 'react'
import './DrawerAura.css'

/**
 * A slow blue-violet aura behind everything in the drawer.
 *
 * The panel used to be a flat wash of black over the scene, which read as a
 * hole cut in the app rather than as part of it. This puts light back behind
 * the cards — the same blues and violets the night sky and the glass are
 * already made of — moving slowly enough that it is noticed once and then
 * forgotten, which is the right amount of attention for a background.
 *
 * Decorative, and says so: nothing here is announced to a screen reader, and
 * it takes no pointer events, so every tap goes to the card above it.
 *
 * See DrawerAura.css for why none of this is blurred.
 */
function DrawerAura() {
  return (
    <div className="drawer-aura" aria-hidden="true" data-testid="drawer-aura">
      <div className="drawer-aura__stage">
        <span className="drawer-aura__pool drawer-aura__pool--one" />
        <span className="drawer-aura__pool drawer-aura__pool--two" />
        <span className="drawer-aura__pool drawer-aura__pool--three" />
      </div>
    </div>
  )
}

export default DrawerAura
