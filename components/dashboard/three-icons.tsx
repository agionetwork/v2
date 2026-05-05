"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

/**
 * Mini three.js scene helper, copy-aligned with components/landing/pillar-icons.tsx
 * but scoped to the dashboard's smaller header glyphs (32x32 visible, rendered at
 * 64x64 for crispness on hi-DPI). Each icon picks a thin, recognisable silhouette
 * with a single subtle animation — bobbing, slow rotation, or a pulse — so the
 * card titles read as a quiet motion accent rather than a distraction.
 */
function useMiniScene(
  buildScene: (scene: THREE.Scene) => void,
  onAnimate?: (time: number) => void
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(64, 64)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0, 4)

    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 1.0)
    dir.position.set(2, 3, 4)
    scene.add(dir)
    const rim = new THREE.DirectionalLight(0x60a5fa, 0.6)
    rim.position.set(-2, -1, -2)
    scene.add(rim)

    buildScene(scene)

    let raf = 0
    const start = performance.now()

    function animate() {
      raf = requestAnimationFrame(animate)
      const t = (performance.now() - start) / 1000
      onAnimate?.(t)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
    }
  }, [buildScene, onAnimate])

  return canvasRef
}

const ICON_CANVAS_SIZE = 64

interface IconProps {
  /** Display size in CSS px. Defaults to 32 to match the shadcn header pattern. */
  size?: number
}

/**
 * Liquidity: a vertical stack of three coin discs. Each coin spins about its
 * vertical axis with a small phase offset so the pile looks alive without
 * drifting around. Used on the "Your Liquidity" card title.
 */
export function LiquidityIcon({ size = 32 }: IconProps = {}) {
  const groupRef = useRef<THREE.Group | null>(null)
  const coinsRef = useRef<THREE.Mesh[]>([])

  const ref = useMiniScene((scene) => {
    const group = new THREE.Group()
    coinsRef.current = []

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x4a90ff,
      metalness: 0.55,
      roughness: 0.3,
    })
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x1358ec,
      metalness: 0.6,
      roughness: 0.25,
    })

    const radii = [0.62, 0.62, 0.62]
    const ys = [-0.55, 0, 0.55]

    radii.forEach((r, i) => {
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 0.18, 36),
        baseMat
      )
      coin.position.y = ys[i]
      coinsRef.current.push(coin)
      group.add(coin)

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(r + 0.005, 0.035, 10, 36),
        rimMat
      )
      rim.rotation.x = Math.PI / 2
      rim.position.y = ys[i]
      group.add(rim)
    })

    // $ glyph on the top coin so the stack reads as currency at a glance.
    const dollarCanvas = document.createElement("canvas")
    dollarCanvas.width = 64
    dollarCanvas.height = 64
    const ctx = dollarCanvas.getContext("2d")!
    ctx.clearRect(0, 0, 64, 64)
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 46px Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("$", 32, 34)
    const dollarTex = new THREE.CanvasTexture(dollarCanvas)
    const dollarMat = new THREE.MeshStandardMaterial({
      map: dollarTex,
      transparent: true,
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
      depthWrite: false,
    })
    const dollar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      dollarMat
    )
    dollar.position.set(0, 0.65, 0)
    dollar.rotation.x = -Math.PI / 2
    group.add(dollar)

    group.rotation.x = 0.4
    groupRef.current = group
    scene.add(group)
  }, (t) => {
    coinsRef.current.forEach((coin, i) => {
      coin.rotation.y = t * 0.6 + i * 0.7
    })
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.9) * 0.05
    }
  })

  return (
    <canvas
      ref={ref}
      width={ICON_CANVAS_SIZE}
      height={ICON_CANVAS_SIZE}
      style={{ width: size, height: size }}
    />
  )
}

/**
 * Asset Distribution: a 3D torus rendered in 4 brand-tinted segments that
 * rotates slowly around the y-axis. Reads as a donut chart even at icon
 * scale. Used on the "Asset Distribution" card title.
 */
export function AssetDonutIcon({ size = 32 }: IconProps = {}) {
  const groupRef = useRef<THREE.Group | null>(null)

  const ref = useMiniScene((scene) => {
    const group = new THREE.Group()

    const segmentColors = [0x4a90ff, 0x1358ec, 0x60a5fa, 0x7c3aed]
    const segments = 4
    const arc = (Math.PI * 2) / segments

    for (let i = 0; i < segments; i++) {
      const torusGeo = new THREE.TorusGeometry(
        0.7,
        0.22,
        14,
        24,
        arc - 0.08
      )
      const mat = new THREE.MeshStandardMaterial({
        color: segmentColors[i],
        metalness: 0.5,
        roughness: 0.3,
        emissive: segmentColors[i],
        emissiveIntensity: 0.18,
      })
      const segment = new THREE.Mesh(torusGeo, mat)
      segment.rotation.z = i * arc
      group.add(segment)
    }

    group.rotation.x = -0.55
    group.rotation.z = 0.2
    groupRef.current = group
    scene.add(group)
  }, (t) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.4
    }
  })

  return (
    <canvas
      ref={ref}
      width={ICON_CANVAS_SIZE}
      height={ICON_CANVAS_SIZE}
      style={{ width: size, height: size }}
    />
  )
}

/**
 * Loan Overview: three ascending bar columns whose heights gently breathe so
 * the icon feels like a live chart. Used on the "Loan Overview" card title.
 */
export function LoanChartIcon({ size = 32 }: IconProps = {}) {
  const barsRef = useRef<THREE.Mesh[]>([])

  const ref = useMiniScene((scene) => {
    const group = new THREE.Group()
    barsRef.current = []

    // Base plate
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1358ec,
      metalness: 0.4,
      roughness: 0.45,
      transparent: true,
      opacity: 0.5,
    })
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.06, 0.5),
      baseMat
    )
    base.position.y = -0.6
    group.add(base)

    const baseHeights = [0.55, 0.95, 1.4]
    const xs = [-0.6, 0, 0.6]
    const colors = [0x60a5fa, 0x4a90ff, 0x1358ec]

    baseHeights.forEach((h, i) => {
      const barMat = new THREE.MeshStandardMaterial({
        color: colors[i],
        metalness: 0.5,
        roughness: 0.3,
        emissive: colors[i],
        emissiveIntensity: 0.2,
      })
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, h, 0.35),
        barMat
      )
      bar.position.set(xs[i], -0.6 + h / 2, 0)
      ;(bar as any).baseHeight = h
      barsRef.current.push(bar)
      group.add(bar)
    })

    // Trend arrow line above the bars
    const trendMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    })
    const trendGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.7, -0.12, 0.25),
      new THREE.Vector3(-0.05, 0.18, 0.25),
      new THREE.Vector3(0.65, 0.55, 0.25),
    ])
    const trend = new THREE.Line(trendGeo, trendMat)
    group.add(trend)

    group.rotation.x = 0.18
    group.rotation.y = -0.15
    scene.add(group)
  }, (t) => {
    barsRef.current.forEach((bar, i) => {
      const baseH = (bar as any).baseHeight as number
      const breathe = 1 + Math.sin(t * 1.4 + i * 0.6) * 0.06
      bar.scale.y = breathe
      bar.position.y = -0.6 + (baseH * breathe) / 2
    })
  })

  return (
    <canvas
      ref={ref}
      width={ICON_CANVAS_SIZE}
      height={ICON_CANVAS_SIZE}
      style={{ width: size, height: size }}
    />
  )
}

/**
 * Recent Activity: three concentric rings that pulse outward in a sonar-like
 * loop, signalling "live activity". Used on the "Recent Activity" card title.
 */
export function ActivityPulseIcon({ size = 32 }: IconProps = {}) {
  const ringsRef = useRef<THREE.Mesh[]>([])

  const ref = useMiniScene((scene) => {
    const group = new THREE.Group()
    ringsRef.current = []

    // Inner solid dot
    const dotMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x60a5fa,
      emissiveIntensity: 1,
    })
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      dotMat
    )
    group.add(dot)

    // Three pulse rings
    for (let i = 0; i < 3; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x4a90ff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.36, 36),
        ringMat
      )
      ;(ring as any).phase = i / 3
      ringsRef.current.push(ring)
      group.add(ring)
    }

    group.rotation.x = -0.05
    scene.add(group)
  }, (t) => {
    ringsRef.current.forEach((ring) => {
      const phase = (ring as any).phase as number
      const cycle = 1.6
      const local = ((t / cycle) + phase) % 1
      const scale = 0.6 + local * 1.7
      const opacity = Math.max(0, 0.85 * (1 - local))
      ring.scale.set(scale, scale, scale)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = opacity
    })
  })

  return (
    <canvas
      ref={ref}
      width={ICON_CANVAS_SIZE}
      height={ICON_CANVAS_SIZE}
      style={{ width: size, height: size }}
    />
  )
}
