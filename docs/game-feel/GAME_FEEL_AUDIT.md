# Game-Feel Audit & Polish Guide

Complete game-feel analysis and actionable polish recommendations for "City In A Snowglobe".

---

## 1. Game-Feel Audit (Existing Systems)

### 1.1 City.jsx

**Current State:**
- Static building generation with procedural layout
- Windows have day/night color switching but no transitions
- Buildings have no secondary motion
- No visual response to shake or interaction

**Issues:**
- **Static feel**: Buildings appear frozen despite weather animations around them
- **Missing micro-feedback**: No response to shake, timeline scrubbing, or mode changes
- **Scale perception**: Globe radius (14.5) vs city radius (45) relationship could feel more intentional

**Improvements Without Assets:**
- Add subtle sway animation to buildings based on wind (use windSpeed in City.jsx)
- Window brightness pulse during night (vary emissiveIntensity over time)
- Slight scale pulse on shake trigger (0.98x → 1.02x over 200ms)
- Building cluster "breathing" effect (subtle scale oscillation ±0.5% at 0.3Hz)

**File Reference:** `src/components/City.jsx`

---

### 1.2 WeatherEffects.jsx

**Current State:**
- Particle systems work but emission feels constant
- Shake animation affects group rotation but particles don't respond to velocity
- Thunder flashes are random, not reactive to shake or interaction
- Particle density scales with performance but not interaction intensity

**Issues:**
- **Constant emission**: Particles spawn at fixed rates, no burst on shake
- **Missing reactivity**: Particles don't respond to shake velocity or scrub speed
- **Timing disconnection**: Thunder/snow/rain don't feel synchronized

**Improvements Without Assets:**
- Burst particle emission on shake (3x density for 500ms, then ease back)
- Velocity-based particle spread (use shake angular velocity)
- Reactive thunder flash on shake (force flash on shake trigger)
- Emission intensity scales with timeline scrub speed (faster scrub = more particles)

**File Reference:** `src/components/WeatherEffects.jsx` (lines 789-896)

---

### 1.3 WeatherDrawer.jsx / WeatherUI.jsx

**Current State:**
- Drawer slides in/out with CSS transitions (300ms ease-in-out)
- Search input has debounce but no visual feedback during loading
- Timeline slider updates visuals but no animation preview
- View mode toggles switch instantly without transition

**Issues:**
- **No input feedback**: Search button doesn't show loading state visually
- **Slider feels disconnected**: Timeline scrubbing doesn't preview visuals in real-time
- **Instant transitions**: View mode changes feel jarring

**Improvements Without Assets:**
- Loading spinner on search button during fetch (replace icon with spinner)
- Optimistic UI: Show city name immediately, update weather data after
- Timeline slider preview: Show sun/moon position update during drag (not just on release)
- View mode transitions: Fade between modes (150ms opacity transition)

**File Reference:** `src/components/WeatherDrawer.jsx`, `src/components/WeatherUI.jsx`

---

### 1.4 Shake Snow Globe Interaction

**Current State:**
- Device motion detection (App.jsx:822-840) triggers shake with 2s cooldown
- Shake animation in WeatherEffects (lines 835-863) uses keyframe rotation
- Scene shake in App.jsx (ShakeableScene, lines 1040-1083) uses different animation

**Issues:**
- **Inconsistent animation**: Two different shake systems (WeatherEffects vs ShakeableScene)
- **Abrupt start**: No anticipation/ease-in, rotation starts instantly
- **No particle response**: Particles don't burst or accelerate with shake
- **Missing glass vibration**: Snow globe glass doesn't visually react

**Improvements Without Assets:**
- Unify shake animation (use single system)
- Add ease-in curve (easeOutCubic for start, easeInCubic for end)
- Particle velocity multiplier based on shake intensity
- Glass material opacity/roughness pulse during shake (0.22 → 0.28 → 0.22 over 300ms)

**File Reference:** `src/App.jsx` (ShakeableScene, handleMotion), `src/components/WeatherEffects.jsx` (shakeGroupRef)

---

### 1.5 Sun & Moon Timeline Slider

**Current State:**
- Slider updates `manualHour` state (App.jsx:1109)
- Visual update happens after state change (celestial data recomputes)
- No visual feedback during drag, only on release (WeatherUI.jsx:833-848)

**Issues:**
- **Delayed feedback**: Visual update waits for state → compute → render cycle
- **No preview**: Can't see sun/moon position while dragging
- **Missing easing**: Abrupt jump when releasing slider

**Improvements Without Assets:**
- Preview mode: Update celestial data during drag (not just on release)
- Visual scrub indicator: Show target sun/moon position as ghost during drag
- Smooth transition on release: Ease sun/moon position to final value over 400ms
- Particle density scales with scrub speed (fast scrub = more particles briefly)

**File Reference:** `src/components/WeatherUI.jsx` (time-slider), `src/App.jsx` (onTimeAdjust, manualHour)

---

### 1.6 3D ↔ AR Mode Transitions

**Current State:**
- Mode toggle triggers session re-instantiation (App.jsx:728-733)
- Canvas unmounts/remounts completely (key prop forces re-creation)
- No transition animation or visual masking

**Issues:**
- **Abrupt transition**: Scene disappears/reappears instantly
- **No loading state**: No indication during session initialization
- **Missing fade**: Could use opacity transition during switch

**Improvements Without Assets:**
- Transition mask: Fade to black during switch (200ms), fade in from black (200ms)
- Loading indicator: Show spinner during AR session initialization
- Preserve camera angle: Save 3D camera position, restore similar angle in AR

**File Reference:** `src/App.jsx` (ModeToggle, renderMode, setRenderMode, arSessionKey)

---

## 2. Measurement & Scale Rules

### 2.1 Constants File Structure

Create `src/config/sceneTuning.js`:

```javascript
/**
 * Scene Tuning Constants
 * 
 * These values control perceived speed, scale relationships, and feedback intensity
 * to create consistent game-feel across all interactions.
 */

// Base dimensions (in Three.js units)
export const BASE_GLOBE_RADIUS = 14.5 // Matches SnowGlobe.jsx domeRadius
export const BASE_GLOBE_DOME_CENTER_Y = 9.8 // Height of globe center above base
export const CITY_CONTENT_SCALE = 0.28 // Matches SNOW_GLOBE_CONTENT_SCALE
export const CITY_MAX_RADIUS = 45 // From City.jsx generateCityLayout maxCityRadius

// Particle density scaling
// Multiplier for particle count based on globe radius
export const PARTICLE_DENSITY_MULTIPLIER = 1.0
// Base counts (will be scaled by performance and interaction)
export const BASE_RAIN_COUNT = 1600
export const BASE_SNOW_COUNT = 2600
export const BASE_THUNDER_COUNT = 25

// Shake intensity curve
// Controls how shake intensity decays over time
export const SHAKE_INTENSITY_CURVE = {
  // Exponential decay: intensity = baseIntensity * (1 - progress)^exponent
  exponent: 2.2, // Higher = faster decay
  // Max angular velocity (radians per second)
  maxAngularVelocity: 12,
  // Base duration (ms)
  baseDuration: 3200,
  // Rotation damping (0-1, higher = less damping)
  damping: 0.92
}

// Timeline scrub easing
export const TIMELINE_SCRUB_EASING = {
  // Duration for easing when releasing slider (ms)
  releaseDuration: 400,
  // Easing curve: 'easeOut', 'easeInOut', 'linear'
  releaseCurve: 'easeOut',
  // Preview update rate during drag (ms) - lower = smoother but more expensive
  previewUpdateInterval: 50,
  // Minimum scrub speed to trigger particle burst (pixels per ms)
  minScrubSpeedForBurst: 0.5
}

// Camera and rotation speed
export const CAMERA_DAMPING = 0.05 // Matches OrbitControls dampingFactor
export const CAMERA_MIN_DISTANCE = 18
export const CAMERA_MAX_DISTANCE = 200
// Rotation speed multiplier for shake (1.0 = normal, >1.0 = faster)
export const SHAKE_ROTATION_MULTIPLIER = 1.0

// Particle emission scaling
export const PARTICLE_EMISSION_SCALING = {
  // Burst multiplier on shake (2.0 = double particles)
  shakeBurstMultiplier: 2.5,
  // Burst duration (ms)
  shakeBurstDuration: 600,
  // Ease-out curve for burst decay
  burstDecayCurve: 'easeOutCubic',
  // Scrub speed scaling: particleCount = baseCount * (1 + scrubSpeed * multiplier)
  scrubSpeedMultiplier: 0.3
}

// Animation timing
export const ANIMATION_TIMING = {
  // Drawer slide duration (ms)
  drawerSlideDuration: 300,
  // View mode transition duration (ms)
  viewModeTransitionDuration: 150,
  // Glass vibration duration during shake (ms)
  glassVibrationDuration: 300,
  // Building sway period (seconds)
  buildingSwayPeriod: 4.0,
  // Window brightness pulse period (seconds)
  windowPulsePeriod: 3.5
}

// Scale relationships
export const SCALE_RELATIONSHIPS = {
  // Globe radius to city radius ratio
  globeToCityRatio: BASE_GLOBE_RADIUS / CITY_MAX_RADIUS, // ~0.32
  // Ideal particle density per unit volume
  particlesPerUnitVolume: 0.15,
  // Building height to base radius ratio (affects perceived scale)
  buildingHeightToBaseRatio: 3.5
}
```

**Why Each Exists:**
- **BASE_GLOBE_RADIUS**: Ensures particle systems scale correctly with globe size
- **PARTICLE_DENSITY_MULTIPLIER**: Allows tuning particle density without changing individual counts
- **SHAKE_INTENSITY_CURVE**: Controls perceived "weight" and responsiveness of shake
- **TIMELINE_SCRUB_EASING**: Makes timeline scrubbing feel responsive but smooth
- **PARTICLE_EMISSION_SCALING**: Creates reactive particle bursts that feel connected to interaction
- **SCALE_RELATIONSHIPS**: Ensures visual consistency across globe, city, and particles

---

## 3. Reactive Feedback Map

| User Action | Visual Reaction | Particle Reaction | Sound/Haptic | Duration | Easing | Reduced Motion |
|-------------|----------------|-------------------|--------------|----------|--------|----------------|
| **City search submit** | Button: scale 1.0 → 0.95 → 1.0, spinner icon | None | None | 150ms | easeOut | Static button |
| **City search loading** | Button: spinner replaces icon, opacity 0.8 | None | None | Persistent | None | Static button |
| **Time slider drag start** | Slider thumb: scale 1.0 → 1.15, slight glow | None | None (optional haptic) | 100ms | easeOut | No scale change |
| **Time slider drag** | Sun/moon position updates in real-time, ghost preview | Density scales with scrub speed | None | Real-time | None | Instant update, no preview |
| **Time slider release** | Sun/moon eases to final position, thumb scale back | Brief particle burst if fast scrub | None | 400ms | easeOut | Instant |
| **Weather override toggle** | Toggle: scale 0.95 → 1.05 → 1.0, color flash | Weather particles burst on/off | None | 200ms | easeOut | No scale |
| **Shake globe (button)** | Globe: rotation burst, glass vibration (opacity pulse), city scale pulse 0.98→1.02 | 2.5x particle burst for 600ms | None (optional haptic) | 3200ms shake + 300ms glass | Shake: exponential decay, Glass: sine | No shake, static particles |
| **Shake globe (device)** | Same as button | Same as button | None | Same | Same | Same |
| **Minimal/Compact/Informational switch** | Drawer content: fade opacity 0 → 1 | None | None | 150ms | easeInOut | Instant switch |
| **3D → AR switch** | Canvas fades to black (200ms), fades in from black (200ms) | Particles pause during transition | None | 400ms total | easeInOut | Instant switch, no fade |
| **AR → 3D switch** | Same as above | Same as above | None | 400ms total | easeInOut | Same |

**Implementation Notes:**
- All visual reactions use CSS transitions or R3F `useSpring`/`useFrame` for smoothness
- Particle reactions modify emission rate or velocity, not just count
- Reduced motion: Check `window.matchMedia('(prefers-reduced-motion: reduce)')` before applying
- Haptic suggestions are off by default (require user permission on mobile)

---

## 4. Animation & Motion Polish

### 4.1 Easing Improvements

**Current Issues:**
- Globe rotation uses linear easing (WeatherEffects.jsx:857-862)
- Shake animation uses quadratic decay but no ease-in
- Camera damping (0.05) feels slightly slow

**Improvements:**

#### Globe Rotation (OrbitControls)
```javascript
// In App.jsx, OrbitControls already has dampingFactor={0.05}
// Optionally increase to 0.08 for snappier feel (but test on mobile)
// Or use custom easing via onUpdate callback
```

#### Shake Decay
```javascript
// In WeatherEffects.jsx, replace line 858:
// OLD: const intensity = Math.pow(1 - progress, 2)
// NEW: const intensity = Math.pow(1 - progress, SHAKE_INTENSITY_CURVE.exponent)

// Also add ease-in at start:
const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
const easedProgress = easeInOut(progress)
```

#### Camera Damping
```javascript
// Current: dampingFactor={0.05}
// Optional: Increase to 0.08 for faster feel
// Or implement custom damping curve in OrbitControls onUpdate
```

**Implementation Location:**
- `src/components/WeatherEffects.jsx` (lines 835-863)
- `src/App.jsx` (OrbitControls, line 1153)

---

### 4.2 Squash/Stretch Environmental Feedback

**Globe:**
- On shake: Scale globe vertically (y: 1.0 → 1.02 → 1.0) over 200ms
- On heavy rain: Slight vertical stretch (1.0 → 1.01) based on particle density

**Clouds:**
- On wind change: Horizontal stretch in wind direction (1.0 → 1.05) over 1s

**City Cluster:**
- On shake: Buildings slightly compress toward center (0.98x) then expand (1.02x) over 300ms
- On timeline scrub: Subtle scale pulse (1.0 → 1.005 → 1.0) at scrub start

**Implementation Example:**
```javascript
// In WeatherEffects.jsx, add to CloudLayer useFrame:
const windStretch = useMemo(() => {
  const windMagnitude = Math.sqrt(windVector.x ** 2 + windVector.z ** 2)
  return 1.0 + windMagnitude * 0.05 // Max 5% stretch
}, [windVector])

// In City.jsx, add shake scale pulse:
const shakeScale = useMemo(() => {
  if (!shakeTrigger) return 1.0
  const elapsed = performance.now() - shakeTrigger
  const progress = Math.min(elapsed / 300, 1.0)
  return 1.0 + Math.sin(progress * Math.PI) * 0.02 // 2% pulse
}, [shakeTrigger])
```

**File References:**
- `src/components/WeatherEffects.jsx` (CloudLayer)
- `src/components/City.jsx` (buildings group)
- `src/components/SnowGlobe.jsx` (globe mesh)

---

### 4.3 Secondary Motion

**City Sway:**
```javascript
// In City.jsx, add to building group:
useFrame((state, delta) => {
  const time = state.clock.elapsedTime
  const windInfluence = windSpeed / 10 // Normalize wind speed
  buildingGroup.current.rotation.z = Math.sin(time * 0.5) * 0.01 * windInfluence
  buildingGroup.current.rotation.x = Math.cos(time * 0.7) * 0.008 * windInfluence
})
```

**Cloud Drift:**
- Already implemented (WeatherEffects.jsx:514-547) but could add:
  - Vertical drift variation based on weather (rain = lower, clear = higher)
  - Rotation speed varies by cloud size (larger = slower)

**Star Twinkle Variance:**
- Already implemented (WeatherEffects.jsx:763-764) but could:
  - Vary twinkle speed per star (currently 0.8-1.4, could widen to 0.5-2.0)
  - Add color shift during twinkle (yellow → white → yellow)

**Implementation Location:**
- `src/components/City.jsx` (add useFrame to main building group)
- `src/components/WeatherEffects.jsx` (CloudLayer, StarLayer)

---

### 4.4 R3F Implementation Patterns

**Spring Animations (useSpring from @react-spring/three):**
```javascript
// For smooth state-driven animations (drawer, view modes)
import { useSpring } from '@react-spring/three'

const { opacity } = useSpring({
  opacity: isOpen ? 1 : 0,
  config: { tension: 200, friction: 20 }
})
```

**Frame-Based Animations (useFrame):**
```javascript
// For continuous animations (particles, sway, rotation)
useFrame((state, delta) => {
  // Use delta for frame-rate independent animation
  objectRef.current.rotation.y += delta * rotationSpeed
})
```

**Drei Helpers:**
```javascript
// For easing and utilities
import { useHelper } from '@react-three/drei'
// Or use drei's easing functions if available
```

**Recommendation:** Use `useFrame` for most animations (already in use), add `useSpring` only for UI transitions (drawer, view modes).

---

## 5. Particle System Refinement

### 5.1 Reactive Emission

**Current:** Constant emission rate regardless of interaction.

**Improvement:** Scale emission based on:
- Shake velocity
- Timeline scrub speed
- Weather intensity changes

**Example Implementation:**

```javascript
// In WeatherEffects.jsx, add to RainParticles:
const emissionScaleRef = useRef(1.0)

useEffect(() => {
  if (!shakeTrigger) return
  // Burst emission on shake
  emissionScaleRef.current = PARTICLE_EMISSION_SCALING.shakeBurstMultiplier
  const timer = setTimeout(() => {
    // Ease back to normal
    const start = emissionScaleRef.current
    const startTime = performance.now()
    const easeOut = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / PARTICLE_EMISSION_SCALING.shakeBurstDuration, 1.0)
      emissionScaleRef.current = start * (1 - progress * progress * (2 - progress)) // easeOutCubic
      if (progress < 1.0) requestAnimationFrame(easeOut)
    }
    easeOut()
  }, 100)
  return () => clearTimeout(timer)
}, [shakeTrigger])

// In useFrame, modify particle velocities:
for (let i = 0; i < count; i++) {
  const baseVelocity = particles.velocities[i]
  const scaledVelocity = baseVelocity * emissionScaleRef.current
  positions[i * 3 + 1] -= scaledVelocity
}
```

**File Reference:** `src/components/WeatherEffects.jsx` (RainParticles, SnowParticles)

---

### 5.2 Intensity Scaling Based on Interaction

**Timeline Scrub Speed:**
```javascript
// In WeatherUI.jsx, track scrub speed:
const [scrubSpeed, setScrubSpeed] = useState(0)
const lastScrubTimeRef = useRef(0)
const lastScrubValueRef = useRef(0)

const handleSliderChange = (e) => {
  const value = parseFloat(e.target.value)
  const now = performance.now()
  const timeDelta = now - lastScrubTimeRef.current
  const valueDelta = Math.abs(value - lastScrubValueRef.current)
  
  if (timeDelta > 0) {
    const speed = valueDelta / timeDelta
    setScrubSpeed(speed)
    // Pass to WeatherEffects via prop
  }
  
  lastScrubTimeRef.current = now
  lastScrubValueRef.current = value
}
```

**Pass scrub speed to WeatherEffects:**
```javascript
// In App.jsx:
<WeatherEffects
  // ... existing props
  scrubSpeed={scrubSpeed}
/>

// In WeatherEffects.jsx:
function RainParticles({ performanceScale = 1, scrubSpeed = 0 }) {
  const emissionRate = useMemo(() => {
    const baseRate = 1.0
    const scrubBoost = scrubSpeed * PARTICLE_EMISSION_SCALING.scrubSpeedMultiplier
    return baseRate + scrubBoost
  }, [scrubSpeed])
  
  // Apply emissionRate to particle velocities or spawn rates
}
```

---

### 5.3 Unified Timing

**Problem:** Thunder, snow, rain don't feel synchronized.

**Solution:** Create a unified "weather rhythm" that all particles follow.

```javascript
// In WeatherEffects.jsx, add:
const weatherRhythmRef = useRef({ phase: 0, cycle: 4.0 }) // 4 second cycle

useFrame((state) => {
  const time = state.clock.elapsedTime
  weatherRhythmRef.current.phase = (time % weatherRhythmRef.current.cycle) / weatherRhythmRef.current.cycle
})

// Use phase in particle systems:
// Rain intensity varies with phase (0.8 → 1.2 → 0.8)
const rainIntensity = 1.0 + Math.sin(weatherRhythmRef.current.phase * Math.PI * 2) * 0.2

// Thunder flashes align to phase peaks
const shouldFlash = weatherRhythmRef.current.phase > 0.9 || weatherRhythmRef.current.phase < 0.1
```

**File Reference:** `src/components/WeatherEffects.jsx` (main component)

---

## 6. Perceived Performance Wins

### 6.1 Optimistic UI During City Search

**Current:** Wait for API response before updating UI.

**Improvement:** Show city name immediately, update weather after.

```javascript
// In WeatherUI.jsx handleSubmit:
const handleSubmit = (e) => {
  e.preventDefault()
  if (city.trim()) {
    // Optimistic update: show city name immediately
    onSearch(city) // This should accept a callback or update optimistically
    setShowSuggestions(false)
    // Weather data will update when API call completes
  }
}

// In App.jsx handleSearch:
const handleSearch = useCallback((newCity) => {
  setCity(newCity) // Update immediately (optimistic)
  fetchWeather(newCity) // Fetch in background
}, [weatherService])
```

**File Reference:** `src/components/WeatherUI.jsx` (handleSubmit), `src/App.jsx` (handleSearch)

---

### 6.2 Transition Masking During AR Session Re-instantiation

**Current:** Canvas unmounts/remounts, causing flash.

**Improvement:** Fade overlay during transition.

```javascript
// In App.jsx, add overlay:
const [isTransitioning, setIsTransitioning] = useState(false)

const handleRenderModeChange = (newMode) => {
  if (newMode !== renderMode) {
    setIsTransitioning(true)
    setTimeout(() => {
      setRenderMode(newMode)
      setTimeout(() => setIsTransitioning(false), 200)
    }, 200)
  }
}

// Render overlay:
{isTransitioning && (
  <div 
    className="fixed inset-0 bg-black z-[9999] transition-opacity duration-200"
    style={{ opacity: isTransitioning ? 1 : 0 }}
  />
)}
```

**File Reference:** `src/App.jsx` (ModeToggle usage)

---

### 6.3 Timeline Scrubbing Visual Preview

**Current:** Visuals update only after slider release.

**Improvement:** Preview during drag.

```javascript
// In WeatherUI.jsx, add preview state:
const [previewHour, setPreviewHour] = useState(null)

const handleSliderInput = (e) => {
  const value = parseFloat(e.target.value)
  setPreviewHour(value) // Update preview immediately
  // Debounce actual state update
}

const handleSliderChange = (e) => {
  const value = parseFloat(e.target.value)
  setPreviewHour(null) // Clear preview
  onTimeAdjust(value) // Update actual state
}

// Pass previewHour to App.jsx:
<App
  // ... existing props
  previewHour={previewHour}
/>

// In App.jsx, use previewHour if available:
const effectiveHour = previewHour !== null ? previewHour : manualHour
const celestialData = computeCelestialData(weatherData, null, effectiveHour)
```

**File Reference:** `src/components/WeatherUI.jsx` (time-slider), `src/App.jsx` (celestialData)

---

### 6.4 Avoiding Particle Spikes on Low-End Devices

**Detection Strategy:**

```javascript
// In App.jsx, detect device capability:
const [performanceTier, setPerformanceTier] = useState('default')

useEffect(() => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const isLowEnd = isMobile && (
    navigator.hardwareConcurrency <= 4 || // 4 or fewer CPU cores
    (navigator.deviceMemory && navigator.deviceMemory <= 2) // 2GB or less RAM
  )
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  
  if (prefersReducedMotion) {
    setPerformanceTier('reduced-motion')
  } else if (isLowEnd) {
    setPerformanceTier('mobile-low')
  } else if (isMobile) {
    setPerformanceTier('mobile-ar')
  } else {
    setPerformanceTier('default')
  }
}, [])

// Pass to WeatherEffects:
<WeatherEffects performanceTier={performanceTier} />
```

**Already Implemented:** `performanceTier` is already used in WeatherEffects.jsx (line 800), but detection logic in App.jsx could be enhanced.

**File Reference:** `src/App.jsx` (renderMode === 'ar' check), `src/components/WeatherEffects.jsx` (performanceTier prop)

---

## 7. Optional Delight (Carefully Scoped)

### 7.1 Subtle Glass Vibration on Thunder

**Off by default, opt-in via settings.**

```javascript
// In SnowGlobe.jsx:
const [glassVibration, setGlassVibration] = useState(false) // Controlled by user setting

useFrame((state, delta) => {
  if (!glassVibration || !hasThunder) return
  const time = state.clock.elapsedTime
  const glassMesh = glassRef.current
  if (!glassMesh) return
  
  // Subtle rotation shake on thunder flash
  const thunderIntensity = Math.random() < 0.02 ? 1.0 : 0.0 // Flash detection
  if (thunderIntensity > 0) {
    glassMesh.rotation.x += (Math.random() - 0.5) * 0.005 * thunderIntensity
    glassMesh.rotation.z += (Math.random() - 0.5) * 0.005 * thunderIntensity
  }
  // Dampen back to center
  glassMesh.rotation.x *= 0.95
  glassMesh.rotation.z *= 0.95
})
```

**File Reference:** `src/components/SnowGlobe.jsx`

---

### 7.2 Temperature Shimmer on Heat

**Visual heat distortion on hot days (temp > 85°F).**

```javascript
// In WeatherEffects.jsx or City.jsx:
const temperature = weatherData?.main?.temp || 20 // Celsius
const isHot = temperature > 29.4 // 85°F

// Add post-processing effect or vertex shader distortion
// Simple version: Add heat distortion to glass material
useFrame((state) => {
  if (!isHot) return
  const time = state.clock.elapsedTime
  const heatDistortion = Math.sin(time * 2) * 0.01 // 1% distortion
  glassMaterial.current.roughness = 0.08 + heatDistortion
})
```

**File Reference:** `src/components/SnowGlobe.jsx` (glass material)

---

### 7.3 Moon Glow Pulse

**Subtle moon brightness pulse (2% variation, 4s period).**

```javascript
// In environment/Moon.jsx:
useFrame((state) => {
  const time = state.clock.elapsedTime
  const pulse = 1.0 + Math.sin(time * Math.PI * 2 / 4.0) * 0.02 // 4 second period
  moonMaterial.current.emissiveIntensity = baseIntensity * pulse
})
```

**File Reference:** `src/components/environment/Moon.jsx`

---

### 7.4 Snow Accumulation Visual (Static Only)

**Not animated accumulation, but visual depth change based on snow duration.**

```javascript
// In City.jsx, adjust ground/vegetation color based on snow:
const snowIntensity = hasSnow ? Math.min(snowDuration / 60000, 1.0) : 0 // Normalize to 60s
const groundColor = useMemo(() => {
  const base = new THREE.Color('#3b4f3d')
  const snow = new THREE.Color('#f0f0f0')
  return base.lerp(snow, snowIntensity * 0.3) // 30% max snow tint
}, [snowIntensity])
```

**File Reference:** `src/components/City.jsx` (VegetationRing, ground plane)

---

### 7.5 Window Light Flicker (Night Only)

**Random window flicker for realism (off by default).**

```javascript
// In City.jsx RectangularWindows:
useFrame(() => {
  if (!isNight) return
  const flickerChance = 0.001 // 0.1% per frame
  if (Math.random() < flickerChance) {
    const randomWindow = windowsRefs.current[Math.floor(Math.random() * windowsRefs.current.length)]
    if (randomWindow) {
      // Briefly dim then restore
      randomWindow.material.emissiveIntensity = 0.5
      setTimeout(() => {
        randomWindow.material.emissiveIntensity = 1.45
      }, 100)
    }
  }
})
```

**File Reference:** `src/components/City.jsx` (RectangularWindows)

---

## Implementation Priority

### High Priority (Quick Wins):
1. ✅ Timeline slider preview (visual feedback during drag)
2. ✅ Search button loading state
3. ✅ Shake particle burst (reactive emission)
4. ✅ View mode fade transitions

### Medium Priority (Polish):
5. ✅ Building sway (wind-based secondary motion)
6. ✅ Glass vibration on shake (subtle material pulse)
7. ✅ Particle emission scaling (scrub speed, shake velocity)
8. ✅ Optimistic UI (city search)

### Low Priority (Delight):
9. ✅ Window brightness pulse (night)
10. ✅ Moon glow pulse (optional)
11. ✅ Temperature shimmer (optional, off by default)

---

## Accessibility Considerations

All animations must respect `prefers-reduced-motion`:

```javascript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (prefersReducedMotion) {
  // Skip or minimize animations
  // Use instant transitions
  // Static particles (no motion)
}
```

**Implementation:** Add check in App.jsx and pass flag to all animated components.

---

## Performance Budget

- **Particle systems:** Max 3000 particles total on mobile, 5000 on desktop
- **Animation updates:** Target 60fps, gracefully degrade to 30fps if needed
- **Reduced motion:** Disable all non-essential animations

---

## File Structure for New Code

```
src/
├── config/
│   └── sceneTuning.js          # Constants (NEW)
├── hooks/
│   └── useReducedMotion.js     # Accessibility hook (NEW)
└── components/
    ├── City.jsx                # Add sway, scale pulse
    ├── WeatherEffects.jsx      # Add reactive emission, unified timing
    ├── WeatherDrawer.jsx       # Add transition animations
    ├── WeatherUI.jsx           # Add slider preview, loading states
    └── SnowGlobe.jsx           # Add glass vibration
```

---

**Last Updated:** 2024
**Maintainer:** Game-Feel Team

