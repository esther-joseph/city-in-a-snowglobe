import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { XRSpace, useRequestXRAnchor, useXR } from '@react-three/xr'

/**
 * Nail the globe to the room.
 *
 * Placing it at a fixed offset from the session's origin looks like it should
 * be enough, and is not. A reference space is the headset's best guess at
 * where the room is, and when tracking is lost and recovered — walking into a
 * dark corner, holding the phone close to a blank surface, which is exactly
 * what someone does when they lean in to look inside — that guess is redone.
 * Everything positioned against it moves with it, so the globe is suddenly on
 * the other side of the room.
 *
 * An anchor is the tracking system's own handle on a place. It is updated
 * when the system relocalises, so content on it stays where it was put. This
 * asks for one at the spot the globe should occupy and then renders the globe
 * in that anchor's space.
 *
 * Anchors are an optional feature. Where they are not granted this falls back
 * to the plain offset, which is what it always did.
 */
function AnchoredGlobe({ position, children }) {
  const requestAnchor = useRequestXRAnchor()
  // Asking before there is a session gets nothing back: the reference space
  // it would be measured against does not exist yet. So it is asked for when
  // a session appears, and again if a new one does.
  const session = useXR((state) => state.session)
  const [anchor, setAnchor] = useState(null)

  const pose = useMemo(
    () => ({
      worldPosition: new THREE.Vector3(...position),
      worldQuaternion: new THREE.Quaternion()
    }),
    // A fixed spot in the room: it is asked for once, when the session opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position[0], position[1], position[2]]
  )

  useEffect(() => {
    if (!session) {
      setAnchor(null)
      return undefined
    }

    let cancelled = false

    requestAnchor({ relativeTo: 'world', ...pose })
      .then((granted) => {
        if (!cancelled) setAnchor(granted ?? null)
      })
      .catch(() => {
        // No anchors on this device, or the session refused the feature. The
        // fallback below is what every session used to get.
      })

    return () => {
      cancelled = true
    }
  }, [requestAnchor, pose, session])

  if (anchor?.anchorSpace) {
    return <XRSpace space={anchor.anchorSpace}>{children}</XRSpace>
  }

  return <group position={position}>{children}</group>
}

AnchoredGlobe.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  children: PropTypes.node
}

export default AnchoredGlobe
