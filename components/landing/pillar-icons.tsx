"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

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

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 1.0)
    dir.position.set(2, 3, 4)
    scene.add(dir)
    const rim = new THREE.DirectionalLight(0x60a5fa, 0.5)
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

// Bank icon: white building with blue outline + $ on pediment, floating animation
export function BankIcon() {
  const groupRef = useRef<THREE.Group | null>(null)

  const ref = useMiniScene((scene) => {
    const group = new THREE.Group()

    const outlineMat = new THREE.MeshStandardMaterial({
      color: 0x4a90ff,
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.9,
    })
    const fillMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.5,
    })

    // Base platform
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.1, 0.8),
      outlineMat
    )
    base.position.y = -0.58
    group.add(base)

    // Steps
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.06, 0.7),
      outlineMat
    )
    step.position.y = -0.5
    group.add(step)

    // Pillars (white)
    const pillarGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.95, 8)
    const positions = [-0.52, -0.17, 0.17, 0.52]
    positions.forEach((x) => {
      const pillar = new THREE.Mesh(pillarGeo, fillMat)
      pillar.position.set(x, 0, 0)
      group.add(pillar)
    })

    // Architrave (bar above pillars)
    const architrave = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.1, 0.8),
      outlineMat
    )
    architrave.position.y = 0.52
    group.add(architrave)

    // Pediment (triangle)
    const triShape = new THREE.Shape()
    triShape.moveTo(-0.85, 0)
    triShape.lineTo(0, 0.42)
    triShape.lineTo(0.85, 0)
    triShape.lineTo(-0.85, 0)
    const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.06, bevelEnabled: false })
    const tri = new THREE.Mesh(triGeo, outlineMat)
    tri.position.set(0, 0.57, -0.03)
    group.add(tri)

    // $ symbol on pediment — rendered via canvas texture for a crisp glyph
    const dollarCanvas = document.createElement("canvas")
    dollarCanvas.width = 64
    dollarCanvas.height = 64
    const ctx = dollarCanvas.getContext("2d")!
    ctx.clearRect(0, 0, 64, 64)
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 52px Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("$", 32, 34)

    const dollarTex = new THREE.CanvasTexture(dollarCanvas)
    dollarTex.needsUpdate = true
    const dollarMat = new THREE.MeshStandardMaterial({
      map: dollarTex,
      transparent: true,
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
      emissiveMap: dollarTex,
      depthWrite: false,
    })
    const dollarPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.32),
      dollarMat
    )
    dollarPlane.position.set(0, 0.76, 0.04)
    group.add(dollarPlane)

    group.rotation.x = 0.2
    group.rotation.y = -0.25
    groupRef.current = group
    scene.add(group)
  }, (t) => {
    // Gentle floating bob
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.8) * 0.06
    }
  })

  return <canvas ref={ref} width={64} height={64} className="w-[32px] h-[32px]" />
}

// Globe icon: wireframe sphere rotating slowly
export function GlobeIcon() {
  const groupRef = useRef<THREE.Group | null>(null)

  const ref = useMiniScene((scene) => {
    const wireMat = new THREE.MeshStandardMaterial({
      color: 0x4a90ff,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    })
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 14, 10),
      wireMat
    )

    const group = new THREE.Group()
    group.add(sphere)
    group.rotation.x = 0.3
    groupRef.current = group
    scene.add(group)
  }, (t) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.15
    }
  })

  return <canvas ref={ref} width={64} height={64} className="w-[32px] h-[32px]" />
}

// Robot/Agent icon: bot head with blinking eyes, mouth, animated antenna
export function AgentIcon() {
  const leftEyeRef = useRef<THREE.Mesh | null>(null)
  const rightEyeRef = useRef<THREE.Mesh | null>(null)
  const leftPupilRef = useRef<THREE.Mesh | null>(null)
  const rightPupilRef = useRef<THREE.Mesh | null>(null)
  const antennaBallRef = useRef<THREE.Mesh | null>(null)

  const ref = useMiniScene((scene) => {
    const group = new THREE.Group()

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4a90ff,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.9,
    })

    // Head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.8, 0.8),
      bodyMat
    )
    group.add(head)

    // Eye sockets (white flat discs)
    const eyeSocketMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
    })
    const eyeSocketGeo = new THREE.CircleGeometry(0.13, 16)

    const leftEye = new THREE.Mesh(eyeSocketGeo, eyeSocketMat)
    leftEye.position.set(-0.22, 0.08, 0.401)
    leftEyeRef.current = leftEye
    group.add(leftEye)

    const rightEye = new THREE.Mesh(eyeSocketGeo, eyeSocketMat)
    rightEye.position.set(0.22, 0.08, 0.401)
    rightEyeRef.current = rightEye
    group.add(rightEye)

    // Pupils (single dark dot per eye)
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x0a1230,
    })
    const pupilGeo = new THREE.CircleGeometry(0.055, 12)

    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat)
    leftPupil.position.set(-0.22, 0.08, 0.405)
    leftPupilRef.current = leftPupil
    group.add(leftPupil)

    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat)
    rightPupil.position.set(0.22, 0.08, 0.405)
    rightPupilRef.current = rightPupil
    group.add(rightPupil)

    // Mouth (horizontal bar)
    const mouthMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x60a5fa,
      emissiveIntensity: 0.4,
    })
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.02),
      mouthMat
    )
    mouth.position.set(0, -0.18, 0.41)
    group.add(mouth)

    // Antenna stem
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6),
      bodyMat
    )
    antenna.position.set(0, 0.57, 0)
    group.add(antenna)

    // Antenna ball (will animate)
    const antennaBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        emissive: 0x60a5fa,
        emissiveIntensity: 0.8,
      })
    )
    antennaBall.position.set(0, 0.77, 0)
    antennaBallRef.current = antennaBall
    group.add(antennaBall)

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.6),
      bodyMat
    )
    body.position.y = -0.65
    group.add(body)

    group.rotation.x = 0.15
    scene.add(group)
  }, (t) => {
    // Blink every ~3 seconds (eyes squish to flat for 0.15s)
    const blinkCycle = t % 7
    const isBlinking = blinkCycle > 6.4 && blinkCycle < 6.7
    const eyeScaleY = isBlinking ? 0.1 : 1
    if (leftEyeRef.current) leftEyeRef.current.scale.y = eyeScaleY
    if (rightEyeRef.current) rightEyeRef.current.scale.y = eyeScaleY
    if (leftPupilRef.current) leftPupilRef.current.visible = !isBlinking
    if (rightPupilRef.current) rightPupilRef.current.visible = !isBlinking

    // Antenna ball glow pulse
    if (antennaBallRef.current) {
      const pulse = 0.5 + Math.sin(t * 1.5) * 0.5
      antennaBallRef.current.position.y = 0.77 + Math.sin(t * 1) * 0.03;
      (antennaBallRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + pulse * 0.6
    }
  })

  return <canvas ref={ref} width={64} height={64} className="w-[32px] h-[32px]" />
}

// Bot icon: flat 2D-style gear spinning clockwise
export function BotIcon() {
  const gearRef = useRef<THREE.Mesh | null>(null)

  const ref = useMiniScene((scene) => {
    const gearMat = new THREE.MeshStandardMaterial({
      color: 0x4a90ff,
      metalness: 0.4,
      roughness: 0.4,
    })

    // Flat gear shape with teeth
    const gearShape = new THREE.Shape()
    const teeth = 8
    const outerR = 0.85
    const toothH = 0.2
    const toothW = 0.35 // tooth angular width as fraction of tooth spacing

    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2
      const a1 = ((i + toothW * 0.5) / teeth) * Math.PI * 2
      const a2 = ((i + toothW) / teeth) * Math.PI * 2
      const a3 = ((i + 1) / teeth) * Math.PI * 2

      const r1 = outerR
      const r2 = outerR + toothH

      if (i === 0) {
        gearShape.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1)
      }
      gearShape.lineTo(Math.cos(a0) * r2, Math.sin(a0) * r2)
      gearShape.lineTo(Math.cos(a1) * r2, Math.sin(a1) * r2)
      gearShape.lineTo(Math.cos(a2) * r1, Math.sin(a2) * r1)
      gearShape.lineTo(Math.cos(a3) * r1, Math.sin(a3) * r1)
    }

    // Center hole
    const holePath = new THREE.Path()
    holePath.absellipse(0, 0, 0.3, 0.3, 0, Math.PI * 2, false, 0)
    gearShape.holes.push(holePath)

    // Very thin extrusion for flat/2D look
    const gearGeo = new THREE.ExtrudeGeometry(gearShape, { depth: 0.06, bevelEnabled: false })
    const gear = new THREE.Mesh(gearGeo, gearMat)
    gear.position.z = -0.03
    gearRef.current = gear
    scene.add(gear)
  }, (t) => {
    // Clockwise rotation (negative z rotation)
    if (gearRef.current) {
      gearRef.current.rotation.z = -t * 0.4
    }
  })

  return <canvas ref={ref} width={64} height={64} className="w-[32px] h-[32px]" />
}
