import { useRef, useEffect, useCallback, useState } from 'react'
import type { PlacedItem } from '../types'
import {
  ViewFrontIcon,
  ViewTopIcon,
  ViewSideIcon,
  ViewIsoIcon,
  ExpandIcon,
  CollapseIcon,
  XMarkIcon,
} from './icons'
import {
  type Vec3,
  type Face,
  VIEW_PRESETS,
  toItemCode,
  shadeFace,
  rotateY,
  rotateX,
  projectIso,
  faceCentroid,
  boxCorners,
  boxFaces,
  boxEdges,
  faceShadeType,
  lerp,
  easeOutCubic,
} from '../lib/3d-helpers'

// ── Types ──────────────────────────────────────────────────────────────

export interface AnimatedItem extends PlacedItem {
  animStartTime: number
  animFromPz: number
  animDone: boolean
}

interface ItemTypeInfo {
  id: number
  name: string
  color: string
  showItemCode?: boolean
}

interface Props {
  container: { lengthM: number; widthM: number; heightM: number }
  placedItems: PlacedItem[]
  animatedItems: AnimatedItem[]
  itemTypeMap: Map<number, ItemTypeInfo>
  onAnimationsDone: () => void
}

const ANIM_DURATION = 400 // ms

// ── Component ──────────────────────────────────────────────────────────

export function LivePackingViewer({
  container,
  placedItems,
  animatedItems,
  itemTypeMap,
  onAnimationsDone,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const logicalSizeRef = useRef({ w: 400, h: 300 })

  const rotXRef = useRef(-0.45)
  const rotYRef = useRef(0.65)
  const zoomRef = useRef(1)

  const targetRotXRef = useRef<number | null>(null)
  const targetRotYRef = useRef<number | null>(null)
  const animatingRef = useRef(false)

  const draggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const initialPinchDistRef = useRef<number | null>(null)
  const initialPinchZoomRef = useRef(1)
  const lastTapRef = useRef(0)

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Keep refs for animation loop access
  const placedItemsRef = useRef(placedItems)
  const animatedItemsRef = useRef(animatedItems)
  const itemTypeMapRef = useRef(itemTypeMap)
  const onAnimationsDoneRef = useRef(onAnimationsDone)

  useEffect(() => { placedItemsRef.current = placedItems }, [placedItems])
  useEffect(() => { animatedItemsRef.current = animatedItems }, [animatedItems])
  useEffect(() => { itemTypeMapRef.current = itemTypeMap }, [itemTypeMap])
  useEffect(() => { onAnimationsDoneRef.current = onAnimationsDone }, [onAnimationsDone])

  // ── Draw function ──────────────────────────────────────────────────

  const drawFrame = useCallback((now: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = logicalSizeRef.current.w
    const H = logicalSizeRef.current.h
    const cx = W / 2
    const cy = H / 2

    ctx.clearRect(0, 0, W, H)

    const rotXVal = rotXRef.current
    const rotYVal = rotYRef.current

    const maxDim = Math.max(container.lengthM, container.widthM, container.heightM)
    const baseZoom = Math.min(W, H) / (maxDim * 3.2)
    const zoom = baseZoom * zoomRef.current

    const halfL = container.lengthM / 2
    const halfW = container.widthM / 2
    const halfH = container.heightM / 2

    const transform = (p: Vec3): Vec3 => {
      const centered: Vec3 = {
        x: p.x - halfL,
        y: p.y - halfH,
        z: p.z - halfW,
      }
      return rotateX(rotateY(centered, rotYVal), rotXVal)
    }

    const faces: Face[] = []

    // Build combined item list: static items + animated items with interpolated pz
    const allItems: Array<PlacedItem & { effectivePz: number }> = []

    for (const item of placedItemsRef.current) {
      allItems.push({ ...item, effectivePz: item.pz })
    }

    let hasActiveAnims = false
    for (const anim of animatedItemsRef.current) {
      const elapsed = now - anim.animStartTime
      const t = Math.min(1, elapsed / ANIM_DURATION)
      const easedT = easeOutCubic(t)
      const effectivePz = lerp(anim.animFromPz, anim.pz, easedT)
      allItems.push({ ...anim, effectivePz })
      if (t < 1) hasActiveAnims = true
    }

    // ── Item boxes ─────────────────────────────────────────────────
    for (const item of allItems) {
      const info = itemTypeMapRef.current.get(item.itemTypeId)
      const color = info?.color ?? '#888888'
      const alpha = 0.92

      // Remap: 3D_x = px, 3D_y = pz (height->up), 3D_z = py (width->depth)
      const rawCorners = boxCorners(
        item.px, item.effectivePz, item.py,
        item.placedLengthM, item.placedHeightM, item.placedWidthM,
      )
      const transformedCorners = rawCorners.map(transform)
      const faceQuads = boxFaces(transformedCorners)

      for (let i = 0; i < 6; i++) {
        const verts = faceQuads[i]
        const shade = faceShadeType(verts)
        const centroid = faceCentroid(verts)
        faces.push({
          vertices: verts,
          color: shadeFace(color, shade, alpha),
          alpha,
          depth: centroid.z,
        })
      }
    }

    // ── Item code labels ────────────────────────────────
    type LabelAnchor = { screenX: number; screenY: number; code: string }
    const labelAnchors: LabelAnchor[] = []

    for (const item of allItems) {
      const info = itemTypeMapRef.current.get(item.itemTypeId)
      if (!info?.showItemCode) continue

      const rawCorners = boxCorners(
        item.px, item.effectivePz, item.py,
        item.placedLengthM, item.placedHeightM, item.placedWidthM,
      )
      const tCorners = rawCorners.map(transform)
      const faceQuads = boxFaces(tCorners)

      let minDepth = Infinity
      let frontCentroid: Vec3 | null = null
      for (const verts of faceQuads) {
        const c = faceCentroid(verts)
        if (c.z < minDepth) {
          minDepth = c.z
          frontCentroid = c
        }
      }
      if (frontCentroid) {
        const screen = projectIso(frontCentroid, zoom, cx, cy)
        labelAnchors.push({ screenX: screen.x, screenY: screen.y, code: toItemCode(info.name) })
      }
    }

    // ── Container wireframe ────────────────────────────────────────
    const containerCorners = boxCorners(
      0, 0, 0,
      container.lengthM, container.heightM, container.widthM,
    ).map(transform)

    const edges = boxEdges(containerCorners)

    // ── Sort faces (painter's algorithm) ───────────────────────────
    faces.sort((a, b) => a.depth - b.depth)

    // ── Render faces ───────────────────────────────────────────────
    for (const face of faces) {
      ctx.beginPath()
      const p0 = projectIso(face.vertices[0], zoom, cx, cy)
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < face.vertices.length; i++) {
        const p = projectIso(face.vertices[i], zoom, cx, cy)
        ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()
      ctx.fillStyle = face.color
      ctx.fill()
      ctx.strokeStyle = `rgba(0,0,0,0.3)`
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // ── Render container wireframe ─────────────────────────────────
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = 'rgba(148,163,184,0.7)'
    ctx.lineWidth = 1.5
    for (const [a, b] of edges) {
      const pa = projectIso(a, zoom, cx, cy)
      const pb = projectIso(b, zoom, cx, cy)
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // ── Item code labels ───────────────────────────────────────────
    if (labelAnchors.length > 0) {
      const fontSize = Math.max(8, Math.min(14, zoom * 0.28))
      ctx.font = `bold ${fontSize}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const label of labelAnchors) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillText(label.code, label.screenX + 1, label.screenY + 1)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(label.code, label.screenX, label.screenY)
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    // ── Axis labels ────────────────────────────────────────────────
    const origin = transform({ x: 0, y: 0, z: 0 })
    const axisLen = maxDim * 0.25

    const axes: Array<{ dir: Vec3; label: string; color: string }> = [
      { dir: { x: axisLen, y: 0, z: 0 }, label: 'L', color: '#EF4444' },
      { dir: { x: 0, y: axisLen, z: 0 }, label: 'H', color: '#22C55E' },
      { dir: { x: 0, y: 0, z: axisLen }, label: 'W', color: '#3B82F6' },
    ]

    const originScreen = projectIso(origin, zoom, cx, cy)
    for (const axis of axes) {
      const rotated = rotateX(rotateY(axis.dir, rotYVal), rotXVal)
      const end: Vec3 = {
        x: origin.x + rotated.x,
        y: origin.y + rotated.y,
        z: origin.z + rotated.z,
      }
      const endScreen = projectIso(end, zoom, cx, cy)

      ctx.beginPath()
      ctx.moveTo(originScreen.x, originScreen.y)
      ctx.lineTo(endScreen.x, endScreen.y)
      ctx.strokeStyle = axis.color
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.font = 'bold 13px ui-monospace, monospace'
      ctx.fillStyle = axis.color
      ctx.fillText(axis.label, endScreen.x + 4, endScreen.y - 4)
    }

    return hasActiveAnims
  }, [container])

  // ── Static draw (no animation) ──────────────────────────────────────

  const draw = useCallback(() => {
    drawFrame(performance.now())
  }, [drawFrame])

  // ── Animation loop ──────────────────────────────────────────────────

  const animLoopRef = useRef<number | null>(null)

  const startAnimLoop = useCallback(() => {
    if (animLoopRef.current !== null) return

    const loop = () => {
      const hasActive = drawFrame(performance.now())
      if (hasActive) {
        animLoopRef.current = requestAnimationFrame(loop)
      } else {
        animLoopRef.current = null
        onAnimationsDoneRef.current()
      }
    }
    animLoopRef.current = requestAnimationFrame(loop)
  }, [drawFrame])

  // Start animation loop when animatedItems change
  useEffect(() => {
    if (animatedItems.some(a => !a.animDone)) {
      startAnimLoop()
    } else {
      draw()
    }
  }, [animatedItems, startAnimLoop, draw])

  // Redraw on static items change
  useEffect(() => {
    draw()
  }, [placedItems, draw])

  // Cleanup animation loop
  useEffect(() => {
    return () => {
      if (animLoopRef.current !== null) {
        cancelAnimationFrame(animLoopRef.current)
      }
    }
  }, [])

  // ── Animate to preset ──────────────────────────────────────────────

  const animateToPreset = useCallback((preset: keyof typeof VIEW_PRESETS) => {
    targetRotXRef.current = VIEW_PRESETS[preset].rotX
    targetRotYRef.current = VIEW_PRESETS[preset].rotY

    if (animatingRef.current) return
    animatingRef.current = true

    const animate = () => {
      const tx = targetRotXRef.current
      const ty = targetRotYRef.current
      if (tx === null || ty === null) {
        animatingRef.current = false
        return
      }

      const speed = 0.12
      rotXRef.current = lerp(rotXRef.current, tx, speed)
      rotYRef.current = lerp(rotYRef.current, ty, speed)

      const doneX = Math.abs(rotXRef.current - tx) < 0.001
      const doneY = Math.abs(rotYRef.current - ty) < 0.001

      draw()

      if (doneX && doneY) {
        rotXRef.current = tx
        rotYRef.current = ty
        targetRotXRef.current = null
        targetRotYRef.current = null
        animatingRef.current = false
        draw()
      } else {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [draw])

  // ── Resize observer ────────────────────────────────────────────────

  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width === 0 || height === 0) continue
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        logicalSizeRef.current = { w: width, h: height }
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        draw()
      }
    })

    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [draw])

  // ── Mouse & touch events ───────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onMouseDown = (e: MouseEvent) => {
      draggingRef.current = true
      lastPosRef.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - lastPosRef.current.x
      const dy = e.clientY - lastPosRef.current.y
      rotYRef.current += dx * 0.008
      rotXRef.current += dy * 0.008
      rotXRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotXRef.current))
      lastPosRef.current = { x: e.clientX, y: e.clientY }
      targetRotXRef.current = null
      targetRotYRef.current = null
      draw()
    }

    const onMouseUp = () => {
      draggingRef.current = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      zoomRef.current = Math.max(0.3, Math.min(5, zoomRef.current * factor))
      draw()
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const now = Date.now()
        const touch = e.touches[0]
        if (now - lastTapRef.current < 300) {
          animateToPreset('iso')
          zoomRef.current = 1
          lastTapRef.current = 0
          return
        }
        lastTapRef.current = now
        draggingRef.current = true
        lastPosRef.current = { x: touch.clientX, y: touch.clientY }
      } else if (e.touches.length === 2) {
        draggingRef.current = false
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        initialPinchDistRef.current = Math.sqrt(dx * dx + dy * dy)
        initialPinchZoomRef.current = zoomRef.current
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const scale = dist / initialPinchDistRef.current
        zoomRef.current = Math.max(0.3, Math.min(5, initialPinchZoomRef.current * scale))
        draw()
        return
      }
      if (!draggingRef.current || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - lastPosRef.current.x
      const dy = e.touches[0].clientY - lastPosRef.current.y
      rotYRef.current += dx * 0.008
      rotXRef.current += dy * 0.008
      rotXRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotXRef.current))
      lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      targetRotXRef.current = null
      targetRotYRef.current = null
      draw()
    }

    const onTouchEnd = () => {
      draggingRef.current = false
      initialPinchDistRef.current = null
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [draw, animateToPreset])

  // ── ESC to close fullscreen ────────────────────────────────────────

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {/* View preset buttons */}
      <div className="flex items-center gap-1">
        {(
          [
            { key: 'front' as const, icon: ViewFrontIcon, label: 'Front' },
            { key: 'top' as const, icon: ViewTopIcon, label: 'Top' },
            { key: 'side' as const, icon: ViewSideIcon, label: 'Side' },
            { key: 'iso' as const, icon: ViewIsoIcon, label: '3D' },
          ] as const
        ).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => animateToPreset(key)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-slate-400 hover:text-slate-200 bg-surface border border-border hover:border-slate-600 transition-colors"
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-slate-400 hover:text-slate-200 bg-surface border border-border hover:border-slate-600 transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <CollapseIcon className="w-3.5 h-3.5" /> : <ExpandIcon className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Canvas wrapper */}
      <div
        ref={wrapperRef}
        className={`relative bg-[#060A12] rounded-lg border border-border overflow-hidden cursor-grab active:cursor-grabbing ${
          isFullscreen
            ? 'fixed inset-0 z-50 rounded-none border-0'
            : 'w-full aspect-[4/3]'
        }`}
        style={{ touchAction: 'none' }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface/80 border border-border text-slate-400 hover:text-slate-200 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}

        {!isFullscreen && (
          <div className="absolute bottom-2 right-2 text-[10px] text-slate-500 select-none pointer-events-none hidden md:block">
            Drag to rotate · Scroll to zoom
          </div>
        )}
      </div>
    </div>
  )
}
