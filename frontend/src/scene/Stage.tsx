//THis is the main 3D world.

import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import type { Plant, PlantDispatchDetails } from '../sim'
import { PlantView } from './Plants'
import { EventCard } from '../ui/EventCard'
import type { MarketEvent, Snapshot } from '../events'

const SPACING = 7

//due to height difference between plants, wind turbines have text bubbles being positioned higher hence anchorHeight is set at a greater y position.
const anchorHeight = (plant: Plant) => (plant.fuel === 'WIND' ? 6.4 : plant.fuel === 'SOLAR' ? 2.6 : 4.6)

export function Stage({plants, rows, cards, snapshot, onDismiss,}: {plants: Plant[], rows: PlantDispatchDetails[], cards: MarketEvent[], snapshot: Snapshot, onDismiss: (id: string) => void}) {
  
  
  const rowById = new Map(rows.map((r) => [r.plant.id, r]))
  const offset = ((plants.length - 1) * SPACING) / 2
  const positionOf = (i: number): [number, number, number] => [i * SPACING - offset, 0, 0]



  const distance = Math.max(17, 12 + plants.length * 3.4)

  return (
    // Light setup and camera positioning here
    <Canvas camera={{ position: [0, distance * 0.42, distance], fov: 42 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
      <hemisphereLight args={['#dbeafe', '#1e293b', 2.1]} />
      <directionalLight position={[6, 10, 8]} intensity={1.7} />

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[60, 48]} />
        <meshToonMaterial color="#3f7d5c" />
      </mesh>


      {/* Loop through all defined plants, then create!(with indexed offset of course, derived via positionOf) */}
      {plants.map((plant, i) => {
        const row = rowById.get(plant.id)
        return (
          <PlantView
            key={plant.id}
            plant={plant}
            running={row?.running ?? false}
            load={row ? Math.min(1, row.mw / (plant.capacityMw || 1)) : 0}
            position={positionOf(i)}
          />
        )
      })}

      {/* Plant-anchored event cards. drei's <Html> keeps them glued to the 3D
          point as the camera orbits. */}
      {cards
        .filter((card) => card.anchor.startsWith('plant:'))
        .map((card) => {
          const id = card.anchor.slice('plant:'.length)
          const i = plants.findIndex((p) => p.id === id)
          if (i < 0) return null
          const [x, , z] = positionOf(i)
          return (
            <Html key={card.id} position={[x, anchorHeight(plants[i]), z]} center distanceFactor={undefined} zIndexRange={[40, 0]}>
              <EventCard event={card} snapshot={snapshot} onDismiss={onDismiss} />
            </Html>
          )
        })}

      {/* Standard camera orbit control */}
      <OrbitControls
        target={[0, 2, 0]}
        enablePan={false}
        minDistance={10}
        maxDistance={48}
        minPolarAngle={0.35}
        maxPolarAngle={1.45}
      />
    </Canvas>
  )
}
