

import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { FUELS, type Plant } from '../sim'
import { BlobShadow, ToonBox, ToonCyl } from './toon'
import { Smoke } from './Smoke'

export interface PlantViewProps {
  plant: Plant
  running: boolean
  /** 0..1 — how much of capacity is dispatched. */
  load: number
  position: [number, number, number]
}

//Common base mesh body, so, all of the rest utilise this main body as a rudimentary base
function PlantBody({running, position, children,}: {running: boolean, position: [number, number, number], children: React.ReactNode}) {
  const group = useRef<THREE.Group>(null)
  
  
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const g = group.current
    if (!g) return
    const targetY = position[1] + (running ? 0 : -0.12)
    g.position.y += (targetY - g.position.y) * Math.min(1, dt * 5)
  })

  return (
    <group ref={group} position={position}>
      {children}
    </group>
  )
}

// Gas, coal or the nuclear plants
function ThermalPlant({ plant, running, load, position }: PlantViewProps) {
  const accent = FUELS[plant.fuel].css
  const isNuclear = plant.fuel === 'NUCLEAR'
  const s = isNuclear ? 1.25 : 1.0
  const intensity = running ? 0.45 + load * 0.55 : 0
  const windowColour = running ? '#ffd479' : '#2a3550'

  return (
    <PlantBody running={running} position={position}>
      <BlobShadow radius={2.6} />

      {/* Main hall */}
      <ToonBox args={[3.0, 1.5, 2.0]} color="#e8edf7" position={[0, 0.75, 0]} />
      <ToonBox args={[3.06, 0.32, 2.06]} color={accent} position={[0, 1.15, 0]} />
      <ToonBox args={[3.2, 0.22, 2.2]} color="#2f3a52" position={[0, 1.58, 0]} />

      {/* Fat cooling towers (nuclear gets bigger ones) */}
      {[-1.9, 1.9].map((x) => (
        <ToonCyl key={x} args={[0.62 * s, 0.95 * s, 2.4 * s, 14]} color="#f2f5fb" position={[x, 1.2 * s, -0.2]} />
      ))}

      {/* Chimney */}
      <ToonCyl args={[0.24, 0.3, 2.6, 10]} color="#d6ddec" position={[0, 1.9, 0.6]} />
      <ToonCyl args={[0.3, 0.3, 0.25, 10]} color={accent} position={[0, 3.15, 0.6]} />

      {/* Windows: the instant "is it on?" tell */}
      {[-0.9, 0, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.72, 1.02]}>
          <planeGeometry args={[0.55, 0.45]} />
          <meshBasicMaterial color={windowColour} />
        </mesh>
      ))}

      <Smoke origin={[0, 3.35, 0.6]} intensity={intensity} tint={isNuclear ? '#eaf2ff' : '#d9dfe9'} />
      {[-1.9, 1.9].map((x) => (
        <Smoke key={x} origin={[x, 2.5 * s, -0.2]} intensity={intensity * 0.7} tint="#eef3fb" count={8} />
      ))}
    </PlantBody>
  )
}

//Wind turbine
function WindTurbine({ running, load, position }: PlantViewProps) {
  const rotor = useRef<THREE.Group>(null)
  const spin = useRef(0.35)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const target = running ? 1.4 + load * 2.2 : 0.35
    spin.current += (target - spin.current) * Math.min(1, dt * 2)
    if (rotor.current) rotor.current.rotation.z += spin.current * dt
  })

  return (
    <PlantBody running={running} position={position}>
      <BlobShadow radius={1.6} />
      <ToonCyl args={[0.18, 0.32, 4.2, 10]} color="#f2f5fb" position={[0, 2.1, 0]} />
      <ToonBox args={[0.9, 0.5, 0.5]} color="#e8edf7" position={[0, 4.3, 0]} />

      <group ref={rotor} position={[0, 4.3, 0.4]}>
        <ToonCyl args={[0.16, 0.16, 0.22, 8]} color={FUELS.WIND.css} rotation={[Math.PI / 2, 0, 0]} />
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
            <ToonBox args={[0.22, 2.4, 0.09]} color="#ffffff" position={[0, 1.2, 0]} />
          </group>
        ))}
      </group>
    </PlantBody>
  )
}

//Solar PANEL
function SolarFarm({ running, position }: PlantViewProps) {
  const colour = running ? '#38bdf8' : '#1e3a8a'
  const cells: React.ReactNode[] = []
  for (let row = 0; row < 2; row++) {
    for (let col = -1; col <= 1; col++) {
      const z = row * 1.25 - 0.6
      cells.push(
        <group key={`${row}:${col}`}>
          <ToonBox args={[1.3, 0.09, 0.85]} color={colour} position={[col * 1.5, 0.55, z]} rotation={[-0.45, 0, 0]} />
          <ToonCyl args={[0.06, 0.06, 0.55, 6]} color="#64748b" position={[col * 1.5, 0.28, z]} />
        </group>,
      )
    }
  }
  return (
    <PlantBody running={running} position={position}>
      <BlobShadow radius={2.2} />
      {cells}
    </PlantBody>
  )
}

export function PlantView(props: PlantViewProps) {
  switch (props.plant.fuel) {
    case 'WIND':
      return <WindTurbine {...props} />
    case 'SOLAR':
      return <SolarFarm {...props} />
    default:
      return <ThermalPlant {...props} />
  }
}
