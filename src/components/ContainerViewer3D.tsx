import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type { PackedContainer } from '../types'
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
} from '../lib/3d-helpers'

// ── Types ──────────────────────────────────────────────────────────────

interface ItemTypeInfo {
  id: number
  name: string
  color: string
  showItemCode?: boolean
}

interface Props {
  container: { lengthM: number; widthM: number; heightM: number }
  packed: PackedContainer
  itemTypes: ItemTypeInfo[]
  highlightId: number | null
  onHighlightChange: (id: number | null) => void
  containerCount: number
  activeIndex: number
  onSwipeContainer: (dir: 'prev' | 'next') => void
}

// ── Component ──────────────────────────────────────────────────────────

export function ContainerViewer3D({
  container,
  packed,
  itemTypes,
  highlightId,
  onHighlightChange,
  containerCount,
  activeIndex,
  onSwipeContainer,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const logicalSizeRef = useRef({ w: 400, h: 300 })

  // Rotation & zoom state
  const rotXRef = useRef(-0.45)
  const rotYRef = useRef(0.65)
  const zoomRef = useRef(1)

  // Animation targets for smooth preset transitions
  const targetRotXRef = useRef<number | null>(null)
  const targetRotYRef = useRef<number | null>(null)
  const animatingRef = useRef(false)

  // Drag state
  const draggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  // Pinch zoom state
  const initialPinchDistRef = useRef<number | null>(null)
  const initialPinchZoomRef = useRef(1)

  // Double-tap detection
  const lastTapRef = useRef(0)

  // Swipe detection
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Gesture hint — initialize from localStorage to avoid setState in effect
  const [showHint, setShowHint] = useState(() => {
    const key = 'viewer3d-hint-shown'
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1')
      return true
    }
    return false
  })
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Highlight ref for draw
  const highlightRef = useRef<number | null>(null)
  useEffect(() => {
    highlightRef.current = highlightId
  }, [highlightId])

  // Mobile detection ref
  const isMobileRef = useRef(false)

  // Item type lookup
  const itemTypeMap = useMemo(() => {
    const m = new Map<number, ItemTypeInfo>()
    for (const it of itemTypes) m.set(it.id, it)
    return m
  }, [itemTypes])

  // Unique item types present
  const presentTypes = packed.packedItems
    .map((pi) => itemTypeMap.get(pi.itemTypeId))
    .filter((t): t is ItemTypeInfo => t != null)

  // ── Draw function ──────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = logicalSizeRef.current.w
    const H = logicalSizeRef.current.h
    const cx = W / 2
    const cy = H / 2

    ctx.clearRect(0, 0, W, H)

    const rotX = rotXRef.current
    const rotY = rotYRef.current

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
      return rotateX(rotateY(centered, rotY), rotX)
    }

    const faces: (Face & { itemIdx: number })[] = []
    const hId = highlightRef.current

    // ── Item boxes ─────────────────────────────────────────────────
    for (let itemIdx = 0; itemIdx < packed.placedItems.length; itemIdx++) {
      const item = packed.placedItems[itemIdx]
      const info = itemTypeMap.get(item.itemTypeId)
      const color = info?.color ?? '#888888'
      const isHighlighted = hId === null || hId === item.itemTypeId
      const alpha = isHighlighted ? 0.92 : 0.15

      // Remap: 3D_x = px (length), 3D_y = pz (height→up), 3D_z = py (width→depth)
      const rawCorners = boxCorners(
        item.px, item.pz, item.py,
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
          itemIdx,
        })
      }
    }

    // ── Collect label anchors for ALL front-facing faces ───────────
    type LabelAnchor = {
      poly: { x: number; y: number }[]
      ux: number; uy: number; edgeLenU: number
      vx: number; vy: number; edgeLenV: number
      name: string
      depth: number
      itemIdx: number
    }
    const labelAnchors: LabelAnchor[] = []

    for (let itemIdx = 0; itemIdx < packed.placedItems.length; itemIdx++) {
      const item = packed.placedItems[itemIdx]
      const info = itemTypeMap.get(item.itemTypeId)
      if (!info) continue
      const isHighlighted = hId === null || hId === item.itemTypeId
      if (!isHighlighted) continue

      const rawCorners = boxCorners(
        item.px, item.pz, item.py,
        item.placedLengthM, item.placedHeightM, item.placedWidthM,
      )
      const tCorners = rawCorners.map(transform)
      const faceQuads = boxFaces(tCorners)

      for (const verts of faceQuads) {
        const a = verts[0], b = verts[1], c = verts[2]
        const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
        const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }
        const nz = u.x * v.y - u.y * v.x
        if (nz >= 0) continue // back-facing, skip

        const poly = verts.map(vt => projectIso(vt, zoom, cx, cy))
        const ux = poly[1].x - poly[0].x
        const uy = poly[1].y - poly[0].y
        const vx = poly[3].x - poly[0].x
        const vy = poly[3].y - poly[0].y
        const edgeLenU = Math.sqrt(ux * ux + uy * uy)
        const edgeLenV = Math.sqrt(vx * vx + vy * vy)

        if (edgeLenU > 2 && edgeLenV > 2) {
          const cent = faceCentroid(verts)
          labelAnchors.push({ poly, ux, uy, edgeLenU, vx, vy, edgeLenV, name: info.name, depth: cent.z, itemIdx })
        }
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

    // ── Render faces & collect painted polygons for occlusion ──────
    const paintedPolys: { poly: { x: number; y: number }[]; itemIdx: number; depth: number }[] = []
    for (const face of faces) {
      ctx.beginPath()
      const projected: { x: number; y: number }[] = []
      const p0 = projectIso(face.vertices[0], zoom, cx, cy)
      projected.push(p0)
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < face.vertices.length; i++) {
        const p = projectIso(face.vertices[i], zoom, cx, cy)
        projected.push(p)
        ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()
      ctx.fillStyle = face.color
      ctx.fill()
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 1.2
      ctx.stroke()
      paintedPolys.push({ poly: projected, itemIdx: face.itemIdx, depth: face.depth })
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

    // ── Point-in-polygon test for occlusion ────────────────────────
    const ptInPoly = (px: number, py: number, poly: { x: number; y: number }[]) => {
      let inside = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const yi = poly[i].y, yj = poly[j].y
        if ((yi > py) !== (yj > py) &&
            px < (poly[j].x - poly[i].x) * (py - yi) / (yj - yi) + poly[i].x) {
          inside = !inside
        }
      }
      return inside
    }

    // ── Item name labels (affine-transformed, occlusion-culled) ──
    labelAnchors.sort((a, b) => b.depth - a.depth)
    for (const label of labelAnchors) {
      // Pick longer edge as text x-axis
      let txX: number, txY: number, txLen: number
      let tyX: number, tyY: number, tyLen: number
      if (label.edgeLenU >= label.edgeLenV) {
        txX = label.ux; txY = label.uy; txLen = label.edgeLenU
        tyX = label.vx; tyY = label.vy; tyLen = label.edgeLenV
      } else {
        txX = label.vx; txY = label.vy; txLen = label.edgeLenV
        tyX = label.ux; tyY = label.uy; tyLen = label.edgeLenU
      }

      const fcx = (label.poly[0].x + label.poly[2].x) / 2
      const fcy = (label.poly[0].y + label.poly[2].y) / 2

      // Occlusion check: skip if a face from a DIFFERENT item that was
      // painted later (closer to camera) covers this label's center
      let occluded = false
      for (const pp of paintedPolys) {
        if (pp.itemIdx === label.itemIdx) continue
        if (pp.depth <= label.depth) continue // behind or same depth
        if (ptInPoly(fcx, fcy, pp.poly)) { occluded = true; break }
      }
      if (occluded) continue

      // Two-line label: "Item Name :" then the actual name
      // Compute font sizes for the two lines
      const nameFontSize = Math.min(tyLen * 0.28, 28)
      if (nameFontSize < 3) continue
      const headerFontSize = nameFontSize * 0.6
      const lineGap = nameFontSize * 0.15
      const totalH = headerFontSize + lineGap + nameFontSize
      const line1Y = -(totalH / 2) + headerFontSize / 2
      const line2Y = (totalH / 2) - nameFontSize / 2

      const txnX = txX / txLen, txnY = txY / txLen
      const tynX = tyX / tyLen, tynY = tyY / tyLen
      const padW = txLen * 0.82

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(label.poly[0].x, label.poly[0].y)
      for (let i = 1; i < label.poly.length; i++) ctx.lineTo(label.poly[i].x, label.poly[i].y)
      ctx.closePath()
      ctx.clip()
      ctx.transform(txnX, txnY, tynX, tynY, fcx, fcy)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Line 1: "Item Name :"
      ctx.font = `${headerFontSize}px sans-serif`
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      const headerText = 'Item Name :'
      const hMeasured = ctx.measureText(headerText)
      if (hMeasured.width <= padW) {
        ctx.fillText(headerText, 0, line1Y)
      }

      // Line 2: actual item name (bold, scaled to fit width)
      let finalNameSize = nameFontSize
      ctx.font = `bold ${finalNameSize}px sans-serif`
      const nMeasured = ctx.measureText(label.name)
      if (nMeasured.width > padW && nMeasured.width > 0) {
        finalNameSize = finalNameSize * (padW / nMeasured.width)
        if (finalNameSize < 3) { ctx.restore(); continue }
        ctx.font = `bold ${finalNameSize}px sans-serif`
      }
      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      ctx.fillText(label.name, 0, line2Y)

      ctx.restore()
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
      const rotated = rotateX(rotateY(axis.dir, rotY), rotX)
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

  }, [container, packed.placedItems, itemTypeMap])

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

  // ── Gesture hint auto-hide ──────────────────────────────────────────

  useEffect(() => {
    if (!showHint) return
    hintTimerRef.current = setTimeout(() => setShowHint(false), 3000)
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [showHint])

  // ── Resize observer ────────────────────────────────────────────────

  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width === 0 || height === 0) continue
        // Cap DPR at 2 for performance
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        logicalSizeRef.current = { w: width, h: height }
        isMobileRef.current = width < 768
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        draw()
      }
    })

    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [draw])

  // Redraw on highlight change
  useEffect(() => {
    draw()
  }, [highlightId, draw])

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
      // Cancel any ongoing preset animation
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

    // ── Touch events ─────────────────────────────────────────────

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const now = Date.now()
        const touch = e.touches[0]

        // Double-tap detection
        if (now - lastTapRef.current < 300) {
          // Reset to isometric with animation
          animateToPreset('iso')
          zoomRef.current = 1
          lastTapRef.current = 0
          return
        }
        lastTapRef.current = now

        draggingRef.current = true
        lastPosRef.current = { x: touch.clientX, y: touch.clientY }
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: now }
      } else if (e.touches.length === 2) {
        // Start pinch
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
        // Pinch zoom
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
      // Cancel any ongoing preset animation
      targetRotXRef.current = null
      targetRotYRef.current = null
      draw()
    }

    const onTouchEnd = (e: TouchEvent) => {
      // Detect horizontal swipe for container switching
      if (touchStartRef.current && e.changedTouches.length === 1) {
        const endX = e.changedTouches[0].clientX
        const endY = e.changedTouches[0].clientY
        const dx = endX - touchStartRef.current.x
        const dy = endY - touchStartRef.current.y
        const elapsed = Date.now() - touchStartRef.current.time

        if (elapsed < 400 && Math.abs(dx) > 60 && Math.abs(dy) < 40) {
          onSwipeContainer(dx > 0 ? 'prev' : 'next')
        }
      }

      draggingRef.current = false
      initialPinchDistRef.current = null
      touchStartRef.current = null
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
  }, [draw, animateToPreset, onSwipeContainer])

  // ── ESC to close fullscreen ────────────────────────────────────────

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  // Redraw on fullscreen change (ResizeObserver handles the resize)

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

        {/* Fullscreen toggle */}
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

        {/* Fullscreen close button */}
        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface/80 border border-border text-slate-400 hover:text-slate-200 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}

        {/* Gesture hint overlay */}
        {showHint && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none transition-opacity duration-700"
            style={{ opacity: showHint ? 1 : 0 }}
          >
            <div className="text-center text-xs text-slate-300 space-y-1">
              <p>Drag to rotate</p>
              <p>Pinch to zoom</p>
              <p>Double tap to reset</p>
            </div>
          </div>
        )}

        {/* Drag hint (desktop) */}
        {!isFullscreen && !showHint && (
          <div className="absolute bottom-2 right-2 text-[10px] text-slate-500 select-none pointer-events-none hidden md:block">
            Drag to rotate · Scroll to zoom
          </div>
        )}
      </div>

      {/* Container dots indicator */}
      {containerCount > 1 && (
        <div className="flex justify-center gap-1.5 py-1">
          {Array.from({ length: containerCount }, (_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === activeIndex ? 'bg-accent' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}

      {/* Legend (desktop only — mobile uses bottom sheet) */}
      {presentTypes.length > 0 && (
        <div className="hidden md:flex flex-wrap gap-2">
          {presentTypes.map((t) => {
            const count = packed.packedItems.find((p) => p.itemTypeId === t.id)?.quantity ?? 0
            const isActive = highlightId === null || highlightId === t.id
            return (
              <button
                key={t.id}
                type="button"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                  isActive
                    ? 'border-border bg-surface text-slate-200'
                    : 'border-transparent bg-surface/40 text-slate-500'
                }`}
                onMouseEnter={() => onHighlightChange(t.id)}
                onMouseLeave={() => onHighlightChange(null)}
                onClick={() => onHighlightChange(highlightId === t.id ? null : t.id)}
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                {t.name}
                <span className="text-slate-400">x{count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
