//Coded with help using Claude. Smoke graphics are tough
// Three.js models

import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RAMP } from './toon'

interface Puff {
  life: number
  maxLife: number
  drift: number
}

export function Smoke({
  origin,
  intensity,
  tint = '#dbe2ee',
  count = 12,
}: {
  origin: [number, number, number]
  intensity: number
  tint?: string
  count?: number
}) {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const puffs = useRef<Puff[]>(Array.from({ length: count }, () => ({ life: 0, maxLife: 1, drift: 0 })))
  const spawnClock = useRef(0)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05) // don't let a stalled tab teleport the smoke

    // Spawn: faster when the plant is working harder.
    spawnClock.current -= dt
    if (intensity > 0.01 && spawnClock.current <= 0) {
      spawnClock.current = 0.42 - intensity * 0.22
      const idx = puffs.current.findIndex((p) => p.life <= 0)
      const mesh = idx >= 0 ? meshes.current[idx] : null
      if (idx >= 0 && mesh) {
        const p = puffs.current[idx]
        p.life = p.maxLife = 2.6 + Math.random() * 1.2
        p.drift = (Math.random() - 0.5) * 0.5
        mesh.position.set(origin[0] + (Math.random() - 0.5) * 0.25, origin[1], origin[2])
        mesh.scale.setScalar(0.35)
        mesh.visible = true
      }
    }

    // Advance every live puff.
    puffs.current.forEach((p, i) => {
      const mesh = meshes.current[i]
      if (!mesh || p.life <= 0) return
      p.life -= dt
      const t = 1 - p.life / p.maxLife // 0 -> 1 across its lifetime
      mesh.position.y += dt * (1.15 + t * 0.5)
      mesh.position.x += dt * p.drift * (0.4 + t)
      mesh.scale.setScalar(0.35 + t * 1.15) // puffs swell as they rise
      const mat = mesh.material as THREE.MeshToonMaterial
      mat.opacity = Math.max(0, 0.85 * (1 - t * t))
      if (p.life <= 0) mesh.visible = false
    })
  })

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m
          }}
          visible={false}
        >
          <icosahedronGeometry args={[0.5, 0]} />
          <meshToonMaterial color={tint} gradientMap={RAMP} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}
