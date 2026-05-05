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
 * Liquidity: a single coin standing face-on to the camera with a $ glyph
 * carved into the centre. The coin tilts gently and bobs so it reads as
 * "live currency" without ever rotating the $ out of sight.
 */
export function LiquidityIcon({ size = 32 }: IconProps = {}) {
  const groupRef = useRef<THREE.Group | null>(null)

  const ref = useMiniScene((scene) => {
    const group = new THREE.Group()

    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x4a90ff,
      metalness: 0.6,
      roughness: 0.28,
    })
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x1358ec,
      metalness: 0.7,
      roughness: 0.22,
    })

    // Coin body — short cylinder oriented so its flat faces look at the camera.
    const radius = 1.05
    const thickness = 0.22
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, thickness, 48),
      faceMat
    )
    coin.rotation.x = Math.PI / 2
    group.add(coin)

    // Outer rim ring for an extra metallic edge.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.005, 0.05, 12, 48),
      rimMat
    )
    group.add(rim)

    // Inner ring on the front face for a real-coin engraving feel.
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius - 0.18, 0.025, 10, 48),
      rimMat
    )
    innerRing.position.z = thickness / 2 + 0.005
    group.add(innerRing)

    // $ glyph centered on the front face.
    const dollarCanvas = document.createElement("canvas")
    dollarCanvas.width = 128
    dollarCanvas.height = 128
    const ctx = dollarCanvas.getContext("2d")!
    ctx.clearRect(0, 0, 128, 128)
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 96px Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("$", 64, 70)
    const dollarTex = new THREE.CanvasTexture(dollarCanvas)
    dollarTex.anisotropy = 4
    const dollarMat = new THREE.MeshStandardMaterial({
      map: dollarTex,
      transparent: true,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      depthWrite: false,
    })
    const dollar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      dollarMat
    )
    dollar.position.z = thickness / 2 + 0.012
    group.add(dollar)

    groupRef.current = group
    scene.add(group)
  }, (t) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.9) * 0.18
      groupRef.current.rotation.x = Math.sin(t * 0.6 + 1) * 0.05
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

    // All-blue palette — light → mid → brand → deep navy. Matches the
    // dashboard's blue-only chart aesthetic instead of mixing in violet.
    const segmentColors = [0x93c5fd, 0x60a5fa, 0x4a90ff, 0x1358ec]
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
