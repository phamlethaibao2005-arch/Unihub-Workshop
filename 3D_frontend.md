# UniHub 3D Frontend Design Extraction

Tai lieu nay gom nhung phan quan trong nhat de mang thiet ke frontend 3D tu prototype EmergentAI sang du an that.

## 1. File quan trong can lay

| File | Vai tro |
| --- | --- |
| `components/HolographicCanvas.tsx` | Component 3D hero dung `three` va `@react-three/fiber`. Day la phan quan trong nhat cua thiet ke 3D. |
| `app/page.tsx` | Toan bo UI prototype: landing, nav, workshop grid, auth, dashboard, QR ticket, AI terminal. Nen tach thanh nhieu component nho khi dua sang du an that. |
| `app/globals.css` | Design tokens, button pill, badge, marquee, terminal cursor, scrollbar, font utility. |
| `app/layout.tsx` | Cau hinh font: Inter, Bebas Neue, JetBrains Mono. |
| `tailwind.config.ts` | Theme tokens: mau sac, font family, radius, plugin animate. |
| `app/api/[[...path]]/route.ts` | Mock API va seed workshop. Chi can lay data shape, khong nen dua nguyen backend mock vao production frontend. |

## 2. Dependencies can cai

Neu du an that la Next.js + Tailwind, cai toi thieu:

```bash
npm install three @react-three/fiber framer-motion lucide-react qrcode
npm install tailwindcss-animate
npm install -D @types/qrcode
```

Neu dung Yarn:

```bash
yarn add three @react-three/fiber framer-motion lucide-react qrcode tailwindcss-animate
yarn add -D @types/qrcode
```

Tu `package.json`, cac package lien quan truc tiep toi UI nay:

```json
{
  "@react-three/fiber": "^8.17.10",
  "three": "^0.184.0",
  "framer-motion": "^12.38.0",
  "lucide-react": "^0.516.0",
  "qrcode": "^1.5.4",
  "tailwindcss-animate": "^1.0.7"
}
```

## 3. Component 3D can copy nguyen file

Dat file TypeScript nay vao `components/HolographicCanvas.tsx`.

```tsx
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
    const arr = new Float32Array(800 * 3)
    for (let i = 0; i < 800; i++) {
      const r = 1.8 + Math.random() * 1.6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
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
```

## 4. Cach nhung vao hero Next.js

Trong component page/landing, import bang `dynamic` de tranh SSR loi WebGL:

```tsx
'use client'

import dynamic from 'next/dynamic'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

const HolographicCanvas = dynamic(() => import('@/components/HolographicCanvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-white" />,
})

type Hero3DProps = {
  onCta?: () => void
}

export function Hero3D({ onCta }: Hero3DProps) {
  return (
    <section className="relative bg-white border-b border-hairline">
      <div className="relative h-[88vh] min-h-[640px] overflow-hidden">
        <div className="absolute top-6 left-6 right-6 z-20 flex items-start justify-between text-[11px] tracking-[0.2em] uppercase text-[#111111]/70">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#06b6d4] dot-blink" />
            Live Campaign / Q3.2025
          </div>
          <div className="hidden md:flex items-center gap-6">
            <span>SGN / UTC+7</span>
            <span>NEXT DROP / 28.06</span>
          </div>
        </div>

        <HolographicCanvas />

        <div className="absolute inset-0 z-10 flex flex-col justify-end pb-[6vh] pointer-events-none">
          <div className="px-6 md:px-10 pointer-events-auto">
            <div className="text-[11px] uppercase tracking-[0.25em] text-[#111111]/60 mb-3">
              UniHub Workshop / Drop 03
            </div>
            <h1
              className="font-display uppercase text-[#111111] leading-[0.85] tracking-[-0.02em] max-w-[1100px]"
              style={{ fontSize: 'clamp(56px, 9.2vw, 132px)' }}
            >
              Buoc Vao<br />Khong Gian Tri Thuc<br />
              <span className="inline-flex items-center gap-3">
                Tuong Lai
                <ArrowUpRight className="w-[0.7em] h-[0.7em] -mt-2" />
              </span>
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={onCta} className="pill-outline-image" type="button">
                Kham Pha Ngay <ArrowRight className="w-4 h-4" />
              </button>
              <button className="pill-ghost bg-white/60 backdrop-blur-sm" type="button">
                Xem Chi Tiet He Thong
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 right-6 z-20 hidden md:flex flex-col items-end text-[#111111]">
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-60">Engaged Cohort</div>
          <div className="font-display text-5xl tabular leading-none mt-1">12,408</div>
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-60 mt-1">Sinh vien / 24 truong</div>
        </div>
      </div>
    </section>
  )
}
```

## 5. CSS tokens va utility nen copy

Lay cac phan nay tu `app/globals.css` sang global stylesheet cua du an that.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --ink: #111111;
  --canvas: #ffffff;
  --cloud: #f5f5f5;
  --hairline: #cacacb;
  --red: #d30005;
  --emerald: #007d48;
  --cyan: #06b6d4;
  --violet: #8b5cf6;
}

* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html,
body {
  background: #ffffff;
  color: #111111;
}

.font-display {
  font-family: var(--font-bebas), 'Inter', sans-serif;
  letter-spacing: -0.02em;
}

.font-sans {
  font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
}

.font-mono {
  font-family: var(--font-mono), Menlo, Monaco, Consolas, monospace;
}

.hairline {
  border-color: #cacacb;
}

.pill-primary {
  background: #111111;
  color: #ffffff;
  border-radius: 9999px;
  padding: 14px 28px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: transform .2s ease, background .2s ease;
  border: 1px solid #111111;
}

.pill-primary:hover {
  background: #000;
  transform: translateY(-1px);
}

.pill-outline-image {
  background: #ffffff;
  color: #111111;
  border-radius: 9999px;
  padding: 14px 28px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #ffffff;
  transition: background .2s ease, color .2s ease;
}

.pill-outline-image:hover {
  background: #111111;
  color: #ffffff;
}

.pill-ghost {
  background: transparent;
  color: #111111;
  border-radius: 9999px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #cacacb;
  transition: background .2s ease, color .2s ease, border-color .2s ease;
}

.pill-ghost:hover {
  background: #111111;
  color: #ffffff;
  border-color: #111111;
}

.badge-promo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 4px 10px;
  border: 1px solid #111111;
  background: #ffffff;
  color: #111111;
}

.badge-red {
  border-color: #d30005;
  color: #d30005;
}

.badge-green {
  border-color: #007d48;
  color: #007d48;
}

@keyframes softBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: .25; }
}

.dot-blink {
  animation: softBlink 1.6s ease-in-out infinite;
}

@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.marquee-track {
  animation: marquee 35s linear infinite;
}

@keyframes blinkCursor {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.terminal-cursor::after {
  content: '\2588';
  margin-left: 2px;
  animation: blinkCursor 1s steps(1) infinite;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-thumb {
  background: #cacacb;
}

::-webkit-scrollbar-track {
  background: transparent;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

:focus-visible {
  outline: 2px solid #111111;
  outline-offset: 2px;
}
```

## 6. Tailwind config can merge

Merge cac phan trong `theme.extend` vao `tailwind.config.ts` cua du an that.

```ts
import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        display: ['var(--font-bebas)', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'Menlo', 'monospace'],
      },
      colors: {
        ink: '#111111',
        canvas: '#ffffff',
        cloud: '#f5f5f5',
        hairline: '#cacacb',
        nikered: '#d30005',
        emerald: '#007d48',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
```

## 7. Font setup trong Next layout

Copy vao `app/layout.tsx` neu du an that dung App Router.

```tsx
import type { ReactNode } from 'react'
import { Inter, Bebas_Neue, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
})

const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bebas',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
})

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi" className={`${inter.variable} ${bebas.variable} ${mono.variable}`}>
      <body className="font-sans bg-white text-[#111111] antialiased">{children}</body>
    </html>
  )
}
```

## 8. Cac component nen tach tu `app/page.tsx`

`app/page.tsx` hien la mot file lon. Khi dua sang du an that, nen tach nhu sau:

| Component moi | Lay tu `app/page.tsx` | Ghi chu |
| --- | --- | --- |
| `components/layout/Nav.tsx` | `Nav` | Header sticky, brand UNIHUB, navigation state. |
| `components/landing/Hero3D.tsx` | `Hero` | Hero 3D dung `HolographicCanvas`. |
| `components/landing/WorkshopGrid.tsx` | `SeatBar`, `WorkshopCard`, `WorkshopGrid` | Grid card workshop, filter, seat progress. |
| `components/landing/TechShowcase.tsx` | `TechShowcase` | Section dark technical integrity, SVG system map. |
| `components/landing/EditorialCTA.tsx` | `EditorialCTA` | CTA cuoi landing. |
| `components/auth/AuthPage.tsx` | `GoogleMark`, `GitHubMark`, `NetworkCanvas`, `AuthPage` | Trang login voi canvas network 2D. |
| `components/dashboard/BoardingPass.tsx` | `useQRDataUrl`, `BoardingPass` | Ticket QR hover state. |
| `components/dashboard/AISummaryTerminal.tsx` | `AISummaryTerminal` | Upload PDF terminal UI. |
| `components/dashboard/Dashboard.tsx` | `Dashboard` | Command center layout. |

## 9. Data shape workshop can dung lai

Frontend card can nhan object dang nay:

```ts
export type Workshop = {
  id: string
  title: string
  category: string
  badge: string
  seatsTotal: number
  seatsTaken: number
  date: string
  time: string
  location: string
  speaker: string
  cover: string
  price: number
}

const workshop: Workshop = {
  id: 'ws-001',
  title: 'NEXT-GEN AI PIPELINES',
  category: 'Cong nghe / AI & Big Data',
  badge: 'Just In',
  seatsTotal: 60,
  seatsTaken: 48,
  date: '28.06.2025',
  time: '18:30',
  location: 'Hall A / Innovation Lab',
  speaker: 'Dr. Tran Minh Quan',
  cover: 'https://images.unsplash.com/photo-1491895200222-0fc4a4c35e18',
  price: 0,
}
```

## 10. Nhung diem can sua khi dua sang production

- Text tieng Viet trong prototype dang bi loi encoding o mot so cho. Nen thay lai bang chu tieng Viet dung dau trong du an that.
- `app/api/[[...path]]/route.ts` chi la mock API. Nen thay bang API/backend that cua du an.
- `HolographicCanvas` phu thuoc WebGL, vi vay luon import dynamic voi `ssr: false`.
- Anh workshop dang dung Unsplash remote URL. Neu Next.js chan image remote, them domain vao `next.config.js` hoac doi sang `<img>` nhu prototype.
- Cac snippet trong tai lieu nay da duoc viet theo TypeScript/TSX; neu du an con dung JavaScript thi co the bo type annotations.

## 11. Checklist dua sang du an that

1. Copy `components/HolographicCanvas.tsx`.
2. Cai `three`, `@react-three/fiber`, `framer-motion`, `lucide-react`, `qrcode`.
3. Merge CSS utility tu muc 5 vao global CSS.
4. Merge Tailwind theme tu muc 6.
5. Setup fonts tu muc 7.
6. Tach cac component tu `app/page.tsx` theo bang muc 8.
7. Thay mock API bang API that, giu data shape workshop/ticket/summary neu muon UI khop nhanh.
