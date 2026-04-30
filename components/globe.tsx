"use client"

import { useEffect, useRef, useCallback } from "react"

const CITIES = [
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "New York", lat: 40.71, lon: -74.0 },
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "Lagos", lat: 6.52, lon: 3.38 },
  { name: "Nairobi", lat: -1.29, lon: 36.82 },
  { name: "Mumbai", lat: 19.08, lon: 72.88 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
  { name: "Dubai", lat: 25.2, lon: 55.27 },
  { name: "Mexico City", lat: 19.43, lon: -99.13 },
  { name: "Berlin", lat: 52.52, lon: 13.4 },
  { name: "Buenos Aires", lat: -34.6, lon: -58.38 },
  { name: "Jakarta", lat: -6.21, lon: 106.85 },
  { name: "Istanbul", lat: 41.01, lon: 28.98 },
  { name: "Seoul", lat: 37.57, lon: 126.98 },
  { name: "Toronto", lat: 43.65, lon: -79.38 },
  { name: "Cape Town", lat: -33.92, lon: 18.42 },
  { name: "Hong Kong", lat: 22.3, lon: 114.17 },
  { name: "Lisbon", lat: 38.72, lon: -9.14 },
  { name: "Rio de Janeiro", lat: -22.91, lon: -43.17 },
  { name: "Florianópolis", lat: -27.59, lon: -48.55 },
  { name: "Brasília", lat: -15.78, lon: -47.93 },
  { name: "Porto Seguro", lat: -16.45, lon: -39.06 },
]

// Pre-computed city pair connections for persistent network lines
const CITY_LINKS: [number, number][] = [
  [0, 12], // São Paulo - Buenos Aires
  [0, 3],  // São Paulo - Lagos
  [1, 16], // New York - Toronto
  [1, 2],  // New York - London
  [1, 10], // New York - Mexico City
  [2, 11], // London - Berlin
  [2, 19], // London - Lisbon
  [2, 14], // London - Istanbul
  [3, 4],  // Lagos - Nairobi
  [3, 17], // Lagos - Cape Town
  [4, 9],  // Nairobi - Dubai
  [5, 9],  // Mumbai - Dubai
  [5, 6],  // Mumbai - Singapore
  [5, 18], // Mumbai - Hong Kong
  [6, 13], // Singapore - Jakarta
  [6, 18], // Singapore - Hong Kong
  [7, 15], // Tokyo - Seoul
  [7, 8],  // Tokyo - Sydney
  [8, 13], // Sydney - Jakarta
  [9, 14], // Dubai - Istanbul
  [11, 14],// Berlin - Istanbul
  [15, 18],// Seoul - Hong Kong
  [10, 0], // Mexico City - São Paulo
  [16, 2], // Toronto - London
  [19, 3], // Lisbon - Lagos
  [17, 5], // Cape Town - Mumbai
  [20, 0], // Rio de Janeiro - São Paulo
  [20, 22], // Rio de Janeiro - Brasília
  [21, 20], // Florianópolis - Rio de Janeiro
  [22, 23], // Brasília - Porto Seguro
  [23, 20], // Porto Seguro - Rio de Janeiro
  [21, 12], // Florianópolis - Buenos Aires
]

// Natural Earth 110m land mask – 72 rows x 144 cols (2.5° cells)
// Generated from Natural Earth ne_110m_land.geojson via ray-casting rasterization
const LAND_ROWS: [number, number][][] = [
  [],
  [],
  [],
  [[36,44],[47,66]],
  [[27,27],[30,31],[34,41],[44,63],[77,79],[112,113]],
  [[23,23],[26,26],[28,28],[31,32],[35,35],[44,63],[96,98],[111,116]],
  [[22,25],[34,35],[37,37],[50,63],[93,94],[105,116],[128,128]],
  [[0,0],[9,9],[25,29],[33,34],[36,42],[51,62],[93,94],[99,101],[103,123],[125,132]],
  [[5,25],[27,27],[29,29],[34,36],[38,39],[42,44],[51,60],[79,86],[93,93],[95,98],[100,100],[102,143]],
  [[0,3],[6,37],[42,46],[51,57],[65,65],[77,85],[87,87],[90,143]],
  [[8,35],[37,37],[39,39],[43,45],[51,55],[64,64],[76,79],[81,142]],
  [[6,33],[41,42],[52,54],[74,78],[81,134],[136,140]],
  [[7,10],[17,34],[41,44],[46,46],[74,78],[81,128],[136,136]],
  [[8,8],[19,36],[41,46],[70,70],[75,75],[77,77],[80,126],[134,136]],
  [[20,38],[40,48],[68,69],[71,71],[75,127],[134,135]],
  [[21,49],[70,127]],
  [[22,43],[45,45],[48,50],[70,127]],
  [[22,45],[71,83],[85,85],[87,91],[93,126]],
  [[22,43],[71,74],[76,76],[78,82],[88,90],[92,125],[129,129]],
  [[22,42],[68,72],[77,78],[80,83],[85,86],[88,91],[94,123],[128,128]],
  [[23,41],[68,71],[78,78],[80,80],[83,91],[94,118],[122,122],[128,128]],
  [[23,41],[72,75],[85,119],[123,123],[126,127]],
  [[24,42],[69,75],[86,119],[125,125]],
  [[25,25],[27,38],[68,78],[80,82],[84,84],[86,120]],
  [[26,33],[39,39],[68,90],[92,120]],
  [[28,32],[39,39],[66,85],[87,91],[94,119]],
  [[29,32],[66,85],[87,94],[99,118],[120,120]],
  [[30,32],[36,36],[65,86],[88,95],[100,106],[109,114]],
  [[30,33],[35,36],[43,44],[66,86],[88,94],[101,105],[110,113],[115,115]],
  [[33,36],[65,87],[89,92],[101,104],[111,114],[120,120]],
  [[36,38],[65,90],[102,103],[111,115],[120,121]],
  [[42,42],[44,44],[66,88],[91,91],[102,103],[111,111],[113,114]],
  [[39,39],[41,47],[67,91],[111,111],[122,122]],
  [[41,48],[68,72],[74,91],[104,104],[112,112]],
  [[41,51],[76,90],[111,112],[117,118]],
  [[40,51],[76,89],[112,113],[116,118]],
  [[40,53],[76,88],[112,113],[116,118],[120,120],[124,125]],
  [[40,56],[76,87],[113,113],[120,120],[126,129]],
  [[40,57],[77,87],[114,114],[127,130]],
  [[40,57],[77,87],[119,120],[122,122],[128,128]],
  [[41,56],[77,87]],
  [[41,55],[77,87],[91,91],[124,125]],
  [[43,55],[77,87],[90,91],[121,126],[129,129]],
  [[44,55],[77,85],[90,91],[121,130]],
  [[44,55],[77,85],[89,90],[118,131]],
  [[44,53],[78,85],[89,90],[117,131]],
  [[44,52],[78,84],[117,132]],
  [[43,51],[79,84],[118,132]],
  [[43,51],[79,83],[118,132]],
  [[43,50],[79,81],[118,121],[126,132]],
  [[43,48],[128,131]],
  [[43,47],[130,130],[142,142]],
  [[42,45],[130,130],[141,141]],
  [[43,45],[140,140]],
  [[42,44],[139,139]],
  [[42,44]],
  [[42,43],[48,48]],
  [[43,44]],
  [],
  [],
  [],
  [[48,48]],
  [[46,46],[93,94],[113,113],[117,117]],
  [[45,45],[85,85],[89,99],[103,132]],
  [[42,46],[69,69],[71,98],[101,139]],
  [[23,23],[31,40],[42,47],[65,138]],
  [[14,43],[62,136]],
  [[7,7],[10,40],[52,54],[58,138]],
  [[10,44],[57,135]],
  [[11,139]],
  [[0,143]],
  [[0,143]],
]

// Build bitmap for fast lookup
const LAND_BITMAP: boolean[][] = LAND_ROWS.map(ranges => {
  const row = new Array(144).fill(false)
  for (const [start, end] of ranges) {
    for (let i = start; i <= Math.min(end, 143); i++) row[i] = true
  }
  return row
})

function isLand(lat: number, lon: number): boolean {
  const rows = 72, cols = 144
  let row = Math.floor((90 - lat) / 180 * rows)
  if (row < 0) row = 0; if (row >= rows) row = rows - 1
  let col = Math.floor((lon + 180) / 360 * cols)
  if (col < 0) col = 0; if (col >= cols) col = cols - 1
  return LAND_BITMAP[row]?.[col] ?? false
}

const DEG = Math.PI / 180

function latLonToVec(lat: number, lon: number) {
  const la = lat * DEG, lo = lon * DEG
  return { x: Math.cos(la) * Math.sin(lo), y: Math.sin(la), z: Math.cos(la) * Math.cos(lo) }
}

function rotateY(v: { x: number; y: number; z: number }, a: number) {
  const c = Math.cos(a), s = Math.sin(a)
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }
}
function rotateX(v: { x: number; y: number; z: number }, a: number) {
  const c = Math.cos(a), s = Math.sin(a)
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c }
}

function slerp(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, t: number) {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))
  const omega = Math.acos(dot)
  if (omega < 1e-5) return a
  const so = Math.sin(omega)
  const k0 = Math.sin((1 - t) * omega) / so
  const k1 = Math.sin(t * omega) / so
  return { x: a.x * k0 + b.x * k1, y: a.y * k0 + b.y * k1, z: a.z * k0 + b.z * k1 }
}

type Arc = {
  a: { x: number; y: number; z: number }
  b: { x: number; y: number; z: number }
  born: number
  dur: number
  _done?: boolean
}

// Pre-compute city vectors
const CITY_VECS = CITIES.map(c => latLonToVec(c.lat, c.lon))

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({
    rotY: 0.4,
    rotX: -0.25,
    autoSpin: true,
    velY: 0,
    velX: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    mouse: null as { x: number; y: number } | null,
    arcs: [] as Arc[],
    lastArcTime: 0,
    w: 0,
    h: 0,
    cx: 0,
    cy: 0,
    r: 0,
    dpr: 1,
    autoT: 0 as ReturnType<typeof setTimeout> | 0,
  })

  const project = useCallback((v: { x: number; y: number; z: number }) => {
    const s = stateRef.current
    let p = rotateY(v, s.rotY)
    p = rotateX(p, s.rotX)
    const persp = 1 / (1.6 - p.z * 0.5)
    return { x: s.cx + p.x * s.r * persp, y: s.cy - p.y * s.r * persp, z: p.z }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const s = stateRef.current

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas!.width = rect.width * dpr
      canvas!.height = rect.height * dpr
      s.dpr = dpr
      s.w = rect.width
      s.h = rect.height
      s.cx = s.w / 2
      s.cy = s.h / 2
      s.r = Math.min(s.w, s.h) * 0.42
    }
    resize()
    window.addEventListener("resize", resize)

    const onDown = (e: PointerEvent) => {
      s.dragging = true
      s.autoSpin = false
      s.lastX = e.clientX
      s.lastY = e.clientY
      canvas!.setPointerCapture(e.pointerId)
      canvas!.style.cursor = "grabbing"
    }
    const onMove = (e: PointerEvent) => {
      const rect = canvas!.getBoundingClientRect()
      s.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (s.dragging) {
        const dx = e.clientX - s.lastX
        const dy = e.clientY - s.lastY
        s.rotY += dx * 0.006
        s.rotX += dy * 0.006
        s.rotX = Math.max(-1.2, Math.min(1.2, s.rotX))
        s.velY = dx * 0.006
        s.velX = dy * 0.006
        s.lastX = e.clientX
        s.lastY = e.clientY
      }
    }
    const onUp = () => {
      if (s.dragging) {
        s.dragging = false
        canvas!.style.cursor = "grab"
        clearTimeout(s.autoT as ReturnType<typeof setTimeout>)
        s.autoT = setTimeout(() => { s.autoSpin = true }, 2500)
      }
    }
    const onLeave = () => { s.mouse = null }

    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointercancel", onUp)
    canvas.addEventListener("pointerleave", onLeave)
    canvas.style.cursor = "grab"
    canvas.style.touchAction = "none"

    function strokePath(pts: { x: number; y: number }[], color: string) {
      if (pts.length < 2) return
      ctx!.beginPath()
      ctx!.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx!.lineTo(pts[i].x, pts[i].y)
      ctx!.strokeStyle = color
      ctx!.lineWidth = 1
      ctx!.stroke()
    }

    function drawMeridians() {
      const segs = 64
      for (let i = 0; i < 12; i++) {
        const lon = (i / 12) * 360 - 180
        const front: { x: number; y: number }[] = [], back: { x: number; y: number }[] = []
        for (let j = 0; j <= segs; j++) {
          const lat = -90 + (j / segs) * 180
          const v = latLonToVec(lat, lon)
          const p = project(v)
          ;(p.z >= 0 ? front : back).push(p)
        }
        strokePath(back, "rgba(235,240,245,0.05)")
        strokePath(front, "rgba(235,240,245,0.14)")
      }
      for (let i = 1; i < 9; i++) {
        const lat = -90 + (i / 9) * 180
        const front: { x: number; y: number }[] = [], back: { x: number; y: number }[] = []
        for (let j = 0; j <= segs; j++) {
          const lon = -180 + (j / segs) * 360
          const v = latLonToVec(lat, lon)
          const p = project(v)
          ;(p.z >= 0 ? front : back).push(p)
        }
        strokePath(back, "rgba(235,240,245,0.05)")
        strokePath(front, "rgba(235,240,245,0.14)")
      }
    }

    function drawDots() {
      const rows = 90
      for (let i = 0; i <= rows; i++) {
        const lat = -90 + (i / rows) * 180
        const circumference = Math.cos(lat * DEG)
        const cols = Math.max(4, Math.floor(rows * 2.4 * circumference))
        for (let j = 0; j < cols; j++) {
          const lon = (j / cols) * 360 - 180
          if (!isLand(lat, lon)) continue
          const v = latLonToVec(lat, lon)
          const p = project(v)
          if (p.z < -0.05) continue
          const alpha = Math.max(0.18, 0.25 + p.z * 0.75)
          ctx!.beginPath()
          ctx!.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(143,168,216,${alpha})`
          ctx!.fill()
        }
      }
    }

    const accentRgb = { r: 74, g: 144, b: 255 }
    function accentAlpha(a: number) {
      return `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${a})`
    }

    // Draw persistent network lines between city pairs
    function drawCityNetwork() {
      for (const [ai, bi] of CITY_LINKS) {
        const pa = project(CITY_VECS[ai])
        const pb = project(CITY_VECS[bi])
        // Only draw if at least one end is on the front side
        if (pa.z < -0.2 && pb.z < -0.2) continue
        // Draw a great-circle path for the connection
        const steps = 24
        const va = CITY_VECS[ai], vb = CITY_VECS[bi]
        let prevP: { x: number; y: number; z: number } | null = null
        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          const v = slerp(va, vb, t)
          const p = project(v)
          if (prevP && p.z > -0.2 && prevP.z > -0.2) {
            const frontness = (p.z + prevP.z) / 2
            const alpha = frontness > 0 ? 0.12 : 0.04
            ctx!.beginPath()
            ctx!.moveTo(prevP.x, prevP.y)
            ctx!.lineTo(p.x, p.y)
            ctx!.strokeStyle = accentAlpha(alpha)
            ctx!.lineWidth = 0.6
            ctx!.stroke()
          }
          prevP = p
        }
      }
    }

    function spawnArc(now: number) {
      // Pick a random city link for the animated arc
      const link = CITY_LINKS[Math.floor(Math.random() * CITY_LINKS.length)]
      const [ai, bi] = Math.random() > 0.5 ? link : [link[1], link[0]]
      s.arcs.push({
        a: CITY_VECS[ai],
        b: CITY_VECS[bi],
        born: now,
        dur: 2200 + Math.random() * 1800,
      })
      if (s.arcs.length > 14) s.arcs.shift()
    }

    function drawArcs(now: number) {
      for (const arc of s.arcs) {
        const elapsed = now - arc.born
        const t = Math.min(1, elapsed / arc.dur)
        const headT = t
        const tailT = Math.max(0, t - 0.35)
        const steps = 40
        const pts: { x: number; y: number; z: number }[] = []
        for (let i = 0; i <= steps; i++) {
          const st = tailT + (headT - tailT) * (i / steps)
          const v = slerp(arc.a, arc.b, st)
          const lift = 1 + 0.22 * Math.sin(st * Math.PI)
          pts.push(project({ x: v.x * lift, y: v.y * lift, z: v.z * lift }))
        }
        for (let i = 1; i < pts.length; i++) {
          const p0 = pts[i - 1], p1 = pts[i]
          const frontness = (p0.z + p1.z) / 2
          if (frontness < -0.3) continue
          const alpha = (i / pts.length) * (frontness > 0 ? 1 : 0.35)
          ctx!.beginPath()
          ctx!.moveTo(p0.x, p0.y)
          ctx!.lineTo(p1.x, p1.y)
          ctx!.strokeStyle = accentAlpha(alpha)
          ctx!.lineWidth = frontness > 0 ? 1.6 : 1
          ctx!.stroke()
        }
        const head = pts[pts.length - 1]
        if (head && head.z > -0.3) {
          ctx!.beginPath()
          ctx!.arc(head.x, head.y, 2.6, 0, Math.PI * 2)
          ctx!.fillStyle = accentAlpha(1)
          ctx!.fill()
          ctx!.beginPath()
          ctx!.arc(head.x, head.y, 6, 0, Math.PI * 2)
          ctx!.fillStyle = accentAlpha(0.22)
          ctx!.fill()
        }
        if (t >= 1) arc._done = true
      }
      s.arcs = s.arcs.filter(a => !a._done)
    }

    function drawCities() {
      let hovered: { name: string; p: { x: number; y: number } } | null = null
      for (let ci = 0; ci < CITIES.length; ci++) {
        const c = CITIES[ci]
        const p = project(CITY_VECS[ci])
        if (p.z < 0) continue
        const alpha = 0.4 + p.z * 0.6
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, 1.8, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(235,240,245,${alpha})`
        ctx!.fill()
        if (s.mouse) {
          const dx = s.mouse.x - p.x
          const dy = s.mouse.y - p.y
          if (dx * dx + dy * dy < 100) hovered = { name: c.name, p }
        }
      }
      if (hovered) {
        ctx!.beginPath()
        ctx!.arc(hovered.p.x, hovered.p.y, 5, 0, Math.PI * 2)
        ctx!.strokeStyle = accentAlpha(1)
        ctx!.lineWidth = 1.2
        ctx!.stroke()
        ctx!.font = '11px "JetBrains Mono", ui-monospace, monospace'
        const label = hovered.name.toUpperCase()
        const tw = ctx!.measureText(label).width
        const lx = hovered.p.x + 10
        const ly = hovered.p.y - 6
        ctx!.fillStyle = "rgba(10,14,18,0.85)"
        ctx!.fillRect(lx - 4, ly - 11, tw + 8, 16)
        ctx!.strokeStyle = accentAlpha(1)
        ctx!.lineWidth = 1
        ctx!.strokeRect(lx - 4, ly - 11, tw + 8, 16)
        ctx!.fillStyle = "rgba(235,240,245,0.9)"
        ctx!.fillText(label, lx, ly)
      }
    }

    let raf: number
    function tick(now: number) {
      ctx!.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
      ctx!.clearRect(0, 0, s.w, s.h)

      if (s.autoSpin) s.rotY += 0.0012
      else {
        s.rotY += s.velY
        s.rotX += s.velX
        s.velY *= 0.92
        s.velX *= 0.92
        s.rotX = Math.max(-1.2, Math.min(1.2, s.rotX))
      }

      if (now - s.lastArcTime > 650) {
        s.lastArcTime = now
        spawnArc(now)
      }

      drawMeridians()
      drawDots()
      drawCityNetwork()
      drawArcs(now)
      drawCities()

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
      canvas.removeEventListener("pointerleave", onLeave)
    }
  }, [project])

  return (
    <div className="relative aspect-square w-full max-w-[1100px] mx-auto">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  )
}
