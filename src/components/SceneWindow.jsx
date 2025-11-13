import React, { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, RenderTexture } from '@react-three/drei'
import { XR, Controllers } from '@react-three/xr'
import './SceneWindow.css'

function SceneWindow({ 
  renderMode, 
  celestialData, 
  BaseScene, 
  onClose,
  isOpen 
}) {
  if (!isOpen) return null

  return (
    <div className="scene-window-overlay" onClick={onClose}>
      <div className="scene-window-container" onClick={(e) => e.stopPropagation()}>
        <button className="scene-window-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="scene-window-content">
          {renderMode === '3d' ? (
            <Canvas camera={{ position: [120, 86, 120], fov: 28, near: 0.1, far: 360 }}>
              <Suspense fallback={null}>
                <color attach="background" args={[celestialData.backgroundColor]} />
                <BaseScene includeSky />
                <OrbitControls 
                  enablePan
                  enableZoom
                  enableRotate
                  minDistance={18}
                  maxDistance={200}
                  maxPolarAngle={Math.PI / 2}
                  target={[0, 7, 0]}
                />
              </Suspense>
            </Canvas>
          ) : (
            <Canvas
              camera={{ position: [0, 1.4, 3.4], fov: 45 }}
              onCreated={({ gl }) => {
                gl.xr.enabled = true
              }}
              style={{ width: '100%', height: '100%' }}
            >
              <Suspense fallback={null}>
                <XR referenceSpace="local-floor">
                  <Controllers />
                  <ARGlobeBillboard
                    backgroundColor={celestialData.backgroundColor}
                    renderScene={() => <BaseScene includeSky />}
                  />
                </XR>
              </Suspense>
            </Canvas>
          )}
        </div>
      </div>
    </div>
  )
}

function ARGlobeBillboard({ backgroundColor, renderScene }) {
  const cameraRef = useRef(null)

  return (
    <group position={[0, 1.25, -2.15]} scale={[1.5, 1.5, 1.5]}>
      <mesh rotation={[-Math.PI / 8, 0, 0]}>
        <planeGeometry args={[3.8, 3]} />
        <meshBasicMaterial toneMapped={false}>
          <RenderTexture attach="map" width={1024} height={1024}>
            <color attach="background" args={[backgroundColor]} />
            <PerspectiveCamera
              ref={cameraRef}
              makeDefault
              position={[120, 86, 120]}
              fov={28}
              near={0.1}
              far={360}
            />
            {renderScene?.()}
          </RenderTexture>
        </meshBasicMaterial>
      </mesh>
    </group>
  )
}

export default SceneWindow

