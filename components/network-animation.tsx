"use client"

import { useEffect, useRef, useState } from 'react'

interface Point {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

interface NetworkAnimationProps {
  className?: string
}

export default function NetworkAnimation({ className = "" }: NetworkAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(false)

  // Configurações da animação
  const POINT_COUNT = 80
  const MAX_DISTANCE = 200
  const MOUSE_INFLUENCE = 0.5
  const POINT_SPEED = 0.8
  const LINE_OPACITY = 0.15

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let currentPoints: Point[] = []

    // Configurar canvas
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Inicializar pontos
    const initializePoints = () => {
      currentPoints = []
      for (let i = 0; i < POINT_COUNT; i++) {
        currentPoints.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * POINT_SPEED,
          vy: (Math.random() - 0.5) * POINT_SPEED,
          size: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.3
        })
      }
      setIsVisible(true)
    }

    initializePoints()

    // Função de animação otimizada
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Atualizar posições dos pontos
      for (let i = 0; i < currentPoints.length; i++) {
        const point = currentPoints[i]
        let newX = point.x + point.vx
        let newY = point.y + point.vy

        // Influência do mouse (repulsão)
        const dx = point.x - mouseRef.current.x
        const dy = point.y - mouseRef.current.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance < MAX_DISTANCE && distance > 0) {
          const force = (MAX_DISTANCE - distance) / MAX_DISTANCE
          const normalizedDx = dx / distance
          const normalizedDy = dy / distance
          newX += normalizedDx * force * MOUSE_INFLUENCE * 0.02
          newY += normalizedDy * force * MOUSE_INFLUENCE * 0.02
        }

        // Bounce nas bordas
        if (newX < 0 || newX > canvas.width) {
          point.vx *= -1
          newX = point.x
        }
        if (newY < 0 || newY > canvas.height) {
          point.vy *= -1
          newY = point.y
        }

        point.x = newX
        point.y = newY
      }

      // Desenhar linhas entre pontos próximos
      ctx.strokeStyle = `rgba(59, 130, 246, ${LINE_OPACITY})`
      ctx.lineWidth = 1

      for (let i = 0; i < currentPoints.length; i++) {
        for (let j = i + 1; j < currentPoints.length; j++) {
          const dx = currentPoints[i].x - currentPoints[j].x
          const dy = currentPoints[i].y - currentPoints[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          // Conectar pontos em diferentes distâncias com opacidades diferentes
          if (distance < MAX_DISTANCE) {
            const opacity = (MAX_DISTANCE - distance) / MAX_DISTANCE
            ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * LINE_OPACITY})`
            
            ctx.beginPath()
            ctx.moveTo(currentPoints[i].x, currentPoints[i].y)
            ctx.lineTo(currentPoints[j].x, currentPoints[j].y)
            ctx.stroke()
          }
          
          // Linhas mais fracas para pontos mais distantes
          if (distance < MAX_DISTANCE * 1.5) {
            const opacity = (MAX_DISTANCE * 1.5 - distance) / (MAX_DISTANCE * 1.5)
            ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * LINE_OPACITY * 0.3})`
            
            ctx.beginPath()
            ctx.moveTo(currentPoints[i].x, currentPoints[i].y)
            ctx.lineTo(currentPoints[j].x, currentPoints[j].y)
            ctx.stroke()
          }
        }
      }

      // Desenhar pontos
      for (let i = 0; i < currentPoints.length; i++) {
        const point = currentPoints[i]
        ctx.beginPath()
        ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59, 130, 246, ${point.opacity})`
        ctx.fill()
      }

      animationId = requestAnimationFrame(animate)
    }

    // Event listeners para mouse
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)

    // Iniciar animação
    animate()

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [])

  return (
    <div className={`fixed inset-0 pointer-events-none ${className}`}>
      <canvas
        ref={canvasRef}
        className={`w-full h-full transition-opacity duration-1000 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: 'transparent' }}
      />
    </div>
  )
}
