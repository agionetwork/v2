"use client"

import { useEffect, useRef } from "react"

export function ConstellationBg() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const g = svg.querySelector("#constellation-g") as SVGGElement
    if (!g) return

    const W = 1400, H = 800, N = 60
    const pts: { x: number; y: number; vx: number; vy: number }[] = []
    for (let i = 0; i < N; i++) {
      pts.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
      })
    }

    const svgNS = "http://www.w3.org/2000/svg"
    const dots = pts.map(p => {
      const c = document.createElementNS(svgNS, "circle")
      c.setAttribute("r", "1.5")
      c.setAttribute("fill", "#4A90FF")
      c.setAttribute("opacity", "0.6")
      c.setAttribute("cx", String(p.x))
      c.setAttribute("cy", String(p.y))
      g.appendChild(c)
      return c
    })
    const lines: SVGLineElement[] = []
    for (let i = 0; i < 140; i++) {
      const l = document.createElementNS(svgNS, "line")
      l.setAttribute("stroke", "#4A90FF")
      l.setAttribute("stroke-width", "0.6")
      l.style.display = "none"
      g.appendChild(l)
      lines.push(l)
    }

    let raf: number
    function tick() {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1
        dots[i].setAttribute("cx", String(p.x))
        dots[i].setAttribute("cy", String(p.y))
      }
      let li = 0
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 160 && li < lines.length) {
            const l = lines[li++]
            l.setAttribute("x1", String(pts[i].x))
            l.setAttribute("y1", String(pts[i].y))
            l.setAttribute("x2", String(pts[j].x))
            l.setAttribute("y2", String(pts[j].y))
            l.setAttribute("opacity", String((1 - d / 160) * 0.25))
            l.style.display = ""
          }
        }
      }
      for (let k = li; k < lines.length; k++) lines[k].style.display = "none"
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none z-0 opacity-55">
      <svg
        ref={svgRef}
        viewBox="0 0 1400 800"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
      >
        <g id="constellation-g" />
      </svg>
    </div>
  )
}
