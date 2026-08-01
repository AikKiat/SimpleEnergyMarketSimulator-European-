/**
 * toon.tsx — CARTOON PRIMITIVES.
 *
 * Deliberately not photoreal. Two tricks do almost all the work:
 *
 *  1. A 4-step gradient ramp with NearestFilter turns smooth shading into hard
 *     bands — that's cel shading.
 *  2. Each mesh carries a slightly larger clone rendered BACK-faces-only in
 *     near-black, which reads as a chunky outline around the silhouette.
 *
 * All procedural: no models, no textures, no HDRI. Loads instantly and every
 * plant can be recoloured per state, which baked model materials make painful.
 */

import * as THREE from 'three'
import type { ThreeElements } from '@react-three/fiber'

const OUTLINE_COLOUR = '#141826'
const OUTLINE_SCALE = 1.045

/** The cel ramp. NearestFilter is what makes the bands hard instead of smooth. */
function makeRamp(): THREE.DataTexture {
  const steps = new Uint8Array([90, 150, 205, 255])
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}

export const RAMP = makeRamp()

type MeshProps = Omit<ThreeElements['mesh'], 'args'>

export function ToonBox({
  args,
  color,
  outline = OUTLINE_SCALE,
  ...props
}: { args: [number, number, number]; color: THREE.ColorRepresentation; outline?: number } & MeshProps) {
  return (
    <mesh {...props}>
      <boxGeometry args={args} />
      <meshToonMaterial color={color} gradientMap={RAMP} />
      <mesh scale={outline}>
        <boxGeometry args={args} />
        <meshBasicMaterial color={OUTLINE_COLOUR} side={THREE.BackSide} />
      </mesh>
    </mesh>
  )
}

export function ToonCyl({args,color, outline = OUTLINE_SCALE, ...props}: {args: [number, number, number, number], color: THREE.ColorRepresentation, outline?: number} & MeshProps) {
  return (
    <mesh {...props}>
      <cylinderGeometry args={args} />
      <meshToonMaterial color={color} gradientMap={RAMP} />
      <mesh scale={outline}>
        <cylinderGeometry args={args} />
        <meshBasicMaterial color={OUTLINE_COLOUR} side={THREE.BackSide} />
      </mesh>
    </mesh>
  )
}

/** A flat dark ellipse under each plant — cheaper and more cartoon than shadow maps. */
export function BlobShadow({ radius = 2.4 }: { radius?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[radius, 24]} />
      <meshBasicMaterial color="#0b1020" transparent opacity={0.26} />
    </mesh>
  )
}
