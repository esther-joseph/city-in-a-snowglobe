import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AD_CLIENT, AD_SLOTS } from '../../services/ads/adConfig'
import { adPlatform, adsEnabled, fillAdSlot, loadAdSense } from '../../services/ads/adProvider'
import { hideNativeBanner, showNativeBanner } from '../../services/ads/nativeBanner'

/**
 * One ad position, named rather than described.
 *
 * The caller says where the slot is — "drawer-banner" — and this decides what
 * fills it: an AdSense <ins> on the web, an AdMob banner in the Play build, or
 * nothing at all when ads are off or the slot has no id yet. Swapping networks
 * is editing adConfig.js; no caller changes.
 *
 * The container reserves its height whether or not an ad arrives, so a late
 * fill does not shove the panel around under the reader's thumb.
 */
function AdSlot({ name, renderMode = '3d', className = '' }) {
  const config = AD_SLOTS[name]
  const platform = adPlatform()
  const enabled = Boolean(config) && adsEnabled({ renderMode })
  const insRef = useRef(null)
  const pushedRef = useRef(false)
  const [filled, setFilled] = useState(false)

  const webSlot = config?.web?.slot ?? null
  const nativeUnit = config?.native?.unit ?? null

  useEffect(() => {
    if (!enabled || platform !== 'web' || !webSlot || pushedRef.current) return
    loadAdSense()
    if (fillAdSlot(insRef.current)) {
      pushedRef.current = true
      setFilled(true)
    }
  }, [enabled, platform, webSlot])

  useEffect(() => {
    if (!enabled || platform !== 'native' || !nativeUnit) return undefined
    let cancelled = false
    showNativeBanner(config.native).then((shown) => {
      if (!cancelled) setFilled(shown)
    })
    return () => {
      cancelled = true
      hideNativeBanner()
    }
    // config.native is stable for a given slot name.
  }, [enabled, platform, nativeUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null

  // AdMob draws over the webview rather than inside it, so there is nothing to
  // put in the DOM — the banner is already on screen.
  if (platform === 'native') return null

  // No slot id yet. In development that is worth seeing; in production an
  // empty labelled box is just a hole in the layout.
  if (!webSlot && !import.meta.env.DEV) return null

  const minHeight = config.web?.minHeight ?? 90

  return (
    <div className={`w-full mt-6 px-4 pb-2 ${className}`} data-testid={`ad-slot-${name}`}>
      <div
        className="relative w-full bg-white/5 rounded-xl border border-white/10 overflow-hidden flex flex-col items-center justify-center transition-colors duration-300 hover:border-white/20"
        style={{ minHeight: `${minHeight}px` }}
      >
        {/* Required by the AdSense policies: an ad has to be labelled as one. */}
        <span className="absolute top-1 left-2 text-[10px] tracking-wider font-semibold uppercase text-white/30 pointer-events-none">
          Advertisement
        </span>

        <div className="w-full flex items-center justify-center p-2" style={{ minHeight: `${minHeight - 30}px` }}>
          {webSlot ? (
            <ins
              ref={insRef}
              className="adsbygoogle"
              style={{ display: 'block', width: '100%', height: `${minHeight}px` }}
              data-ad-client={AD_CLIENT}
              data-ad-slot={webSlot}
              data-ad-format={config.web?.format ?? 'horizontal'}
              data-full-width-responsive="true"
              data-filled={filled ? 'true' : 'false'}
            />
          ) : (
            <span className="text-[11px] text-white/25">
              Slot “{name}” has no ad unit configured
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

AdSlot.propTypes = {
  name: PropTypes.oneOf(Object.keys(AD_SLOTS)).isRequired,
  renderMode: PropTypes.oneOf(['3d', 'ar']),
  className: PropTypes.string
}

export default AdSlot
