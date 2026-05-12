'use client'

import { Suspense, useMemo, useRef, type MouseEvent, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type PointerState = {
  x: number
  y: number
}

type PointerRef = MutableRefObject<PointerState>

type HolographicCoreProps = {
  pointer: PointerRef
}

function HolographicCore({ pointer }: HolographicCoreProps) {
  const group = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Mesh>(null)
  const innerWire = useRef<THREE.Mesh>(null)
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const particlesRef = useRef<THREE.Points>(null)

  const particlePositions = useMemo<Float32Array>(() => {
    const rand = (seed: number) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    const arr = new Float32Array(800 * 3)
    for (let i = 0; i < 800; i++) {
      const r = 1.8 + rand(i * 1.13) * 1.6
      const theta = rand(i * 2.17) * Math.PI * 2
      const phi = Math.acos(2 * rand(i * 3.19) - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const px = pointer.current.x
    const py = pointer.current.y

    if (group.current) {
      group.current.rotation.y += delta * 0.18
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, py * 0.4, 0.05)
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, px * 0.2, 0.05)
    }
    if (inner.current) {
      inner.current.rotation.x -= delta * 0.4
      inner.current.rotation.y -= delta * 0.3
    }
    if (innerWire.current) {
      innerWire.current.rotation.x -= delta * 0.4
      innerWire.current.rotation.y -= delta * 0.3
    }
    if (ring1.current) ring1.current.rotation.z = t * 0.4
    if (ring2.current) ring2.current.rotation.x = t * 0.55
    if (particlesRef.current) particlesRef.current.rotation.y -= delta * 0.05
  })

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshBasicMaterial color="#111111" wireframe transparent opacity={0.85} />
      </mesh>

      <mesh ref={inner} scale={0.55}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#f5f5f5" />
      </mesh>

      <mesh ref={innerWire} scale={0.56}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#111111" wireframe />
      </mesh>

      <mesh ref={ring1}>
        <torusGeometry args={[2.2, 0.008, 8, 128]} />
        <meshBasicMaterial color="#06b6d4" />
      </mesh>

      <mesh ref={ring2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.6, 0.006, 8, 128]} />
        <meshBasicMaterial color="#8b5cf6" />
      </mesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.018} color="#111111" sizeAttenuation transparent opacity={0.9} />
      </points>
    </group>
  )
}

export default function HolographicCanvas() {
  const pointer = useRef<PointerState>({ x: 0, y: 0 })

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
  }

  return (
    <div className="absolute inset-0" onMouseMove={onMove}>
      <Canvas camera={{ position: [0, 0, 5.2], fov: 50 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.9} />
        <Suspense fallback={null}>
          <HolographicCore pointer={pointer} />
        </Suspense>
      </Canvas>
    </div>
  )
}
