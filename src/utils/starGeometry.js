import * as THREE from 'three'

/**
 * The star the app is built around: a stellated octahedron, eight spikes on a
 * central core.
 *
 * It lived inside WeatherEffects, which is where the night sky uses it. The
 * loading screen wants the same shape, and a loading screen importing the
 * whole weather system to get at one buffer would drag the scene's imports in
 * front of the first paint — so the geometry moved here and both read it.
 *
 * Built once, at module scope, and shared: it is the same star every time.
 */
export const starGeometry = (() => {
  // Create a stellated octahedron (stella octangula) - a proper stellated polyhedron
  // This creates a star shape with 8 spikes extending from a central octahedron
  const baseRadius = 0.3
  const spikeLength = 0.4
  
  // Create vertices for a stellated octahedron
  // An octahedron has 6 vertices, we'll create spikes from each face
  const vertices = []
  const indices = []
  
  // Base octahedron vertices (6 vertices)
  const octahedronVerts = [
    [0, baseRadius, 0],      // Top
    [0, -baseRadius, 0],     // Bottom
    [baseRadius, 0, 0],      // Right
    [-baseRadius, 0, 0],     // Left
    [0, 0, baseRadius],      // Front
    [0, 0, -baseRadius]      // Back
  ]
  
  // For each face of the octahedron, create a spike
  // An octahedron has 8 triangular faces
  const faces = [
    // Top faces
    [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
    // Bottom faces
    [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]
  ]
  
  let vertexIndex = 0
  
  // Create spikes by extending each face outward
  faces.forEach((face, faceIndex) => {
    // Calculate face center
    const v0 = octahedronVerts[face[0]]
    const v1 = octahedronVerts[face[1]]
    const v2 = octahedronVerts[face[2]]
    
    const centerX = (v0[0] + v1[0] + v2[0]) / 3
    const centerY = (v0[1] + v1[1] + v2[1]) / 3
    const centerZ = (v0[2] + v1[2] + v2[2]) / 3
    
    // Normalize to get direction
    const length = Math.sqrt(centerX * centerX + centerY * centerY + centerZ * centerZ)
    const nx = centerX / length
    const ny = centerY / length
    const nz = centerZ / length
    
    // Spike tip
    const spikeTip = [
      nx * (baseRadius + spikeLength),
      ny * (baseRadius + spikeLength),
      nz * (baseRadius + spikeLength)
    ]
    
    // Add the three base vertices and spike tip
    const baseV0 = vertexIndex++
    const baseV1 = vertexIndex++
    const baseV2 = vertexIndex++
    const tip = vertexIndex++
    
    vertices.push(...v0, ...v1, ...v2, ...spikeTip)
    
    // Create three triangular faces from base to tip
    indices.push(baseV0, baseV1, tip)
    indices.push(baseV1, baseV2, tip)
    indices.push(baseV2, baseV0, tip)
  })
  
  // Create geometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  
  return geometry
})()
