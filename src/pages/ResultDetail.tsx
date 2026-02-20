import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../db'
import { useContainerStore } from '../store/containerStore'
import { useItemStore } from '../store/itemStore'
import { packItems } from '../lib/packing'
import { ContainerViewer3D } from '../components/ContainerViewer3D'
import {
  ShareIcon,
  DocumentIcon,
  ArrowLeftIcon,
  ClipboardIcon,
  CheckIcon,
  ContainerIcon,
  PackageIcon,
  ExclamationIcon,
  DragHandleIcon,
} from '../components/icons'
import type { SimulationResult, ContainerType, ItemType, PackingInput } from '../types'

// ── Helpers ─────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN')
}

function cbm(c: ContainerType) {
  return c.lengthM * c.widthM * c.heightM
}

function itemVol(it: ItemType) {
  return it.lengthM * it.widthM * it.heightM
}

// ── What-if scenario type ───────────────────────────────────────────────

interface WhatIfRow {
  label: string
  containers: number
  totalCost: number
  avgUtil: number
  costPerCBM: number
  isCurrent: boolean
}

// ── Export PDF (canvas-based, no dependencies) ──────────────────────────

function generatePDFBlob(
  result: SimulationResult,
  containerMap: Map<number, ContainerType>,
  itemMap: Map<number, ItemType>,
): Blob {
  const lines: string[] = []
  const d = result.computedAt instanceof Date ? result.computedAt : new Date(result.computedAt)
  lines.push('CBM Pack Optimizer — Simulation Report')
  lines.push('='.repeat(45))
  lines.push(`Date: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`)
  lines.push('')
  lines.push('Summary')
  lines.push('-'.repeat(30))
  lines.push(`Containers Used: ${result.packedContainers.length}`)
  lines.push(`Total Cost: ${fmtINR(result.totalCost)}`)
  lines.push(`Avg Utilization: ${result.avgUtilization.toFixed(1)}%`)
  const totalPacked = result.packedContainers.reduce(
    (s, pc) => s + pc.packedItems.reduce((ss, pi) => ss + pi.quantity, 0), 0,
  )
  const totalUnpacked = result.unpackedItems.reduce((s, u) => s + u.quantity, 0)
  lines.push(`Items Packed: ${totalPacked}`)
  lines.push(`Items Unpacked: ${totalUnpacked}`)
  lines.push('')

  result.packedContainers.forEach((pc, i) => {
    const ct = containerMap.get(pc.containerTypeId)
    lines.push(`Container ${i + 1}: ${ct?.name ?? 'Unknown'}`)
    lines.push(`  Dimensions: ${ct?.lengthM} × ${ct?.widthM} × ${ct?.heightM} m`)
    lines.push(`  Utilization: ${pc.utilizationPct.toFixed(1)}%`)
    lines.push(`  Weight: ${pc.usedWeightKg.toFixed(1)} / ${ct?.maxWeightKg ?? '?'} kg`)
    lines.push(`  Cost: ${fmtINR(ct?.costPerUnit ?? 0)}`)
    lines.push('  Items:')
    for (const pi of pc.packedItems) {
      const it = itemMap.get(pi.itemTypeId)
      lines.push(`    - ${it?.name ?? 'Unknown'} × ${pi.quantity}`)
    }
    lines.push('')
  })

  if (result.unpackedItems.length > 0) {
    lines.push('Unpacked Items')
    lines.push('-'.repeat(30))
    for (const ui of result.unpackedItems) {
      const it = itemMap.get(ui.itemTypeId)
      lines.push(`  - ${it?.name ?? 'Unknown'} × ${ui.quantity}`)
    }
  }

  return new Blob([lines.join('\n')], { type: 'text/plain' })
}

// ── Bottom Sheet (mobile only) ──────────────────────────────────────────

function ItemBottomSheet({
  itemBreakdown,
  highlightId,
  onHighlightChange,
}: {
  itemBreakdown: Array<{
    itemTypeId: number
    name: string
    color: string
    count: number
    volume: number
    weight: number
  }>
  highlightId: number | null
  onHighlightChange: (id: number | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const dragStartExpanded = useRef(false)

  const totalPacked = itemBreakdown.reduce((s, r) => s + r.count, 0)

  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    dragStartExpanded.current = expanded
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const dy = dragStartY.current - e.touches[0].clientY
    // Dragging up more than 40px expands, down collapses
    if (dy > 40 && !expanded) {
      setExpanded(true)
    } else if (dy < -40 && expanded) {
      setExpanded(false)
    }
  }

  const onTouchEnd = () => {
    dragStartY.current = null
  }

  return (
    <div
      ref={sheetRef}
      className={`fixed left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl transition-all duration-300 md:hidden ${
        expanded ? 'max-h-[60vh]' : 'max-h-14'
      }`}
      style={{ overflow: expanded ? 'auto' : 'hidden', bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Handle bar */}
      <div
        className="flex items-center justify-center py-2 cursor-grab touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-1 rounded-full bg-slate-600" />
      </div>

      {/* Collapsed summary */}
      <div
        className="px-4 pb-2 flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <DragHandleIcon className="w-4 h-4 text-slate-500" />
          <span>{totalPacked} items packed</span>
        </div>
        <span className="text-[10px] text-slate-500">{expanded ? 'Collapse' : 'Expand'}</span>
      </div>

      {/* Expanded item list */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {itemBreakdown.map((row) => {
            const isActive = highlightId === null || highlightId === row.itemTypeId
            return (
              <button
                key={row.itemTypeId}
                type="button"
                onClick={() => onHighlightChange(highlightId === row.itemTypeId ? null : row.itemTypeId)}
                className={`w-full flex items-start gap-2 text-xs p-2 rounded-md transition-all ${
                  isActive ? 'bg-background' : 'bg-surface/40 opacity-50'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5"
                  style={{ backgroundColor: row.color }}
                />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 truncate">{row.name}</span>
                    <span className="text-slate-400 shrink-0 ml-2">x{row.count}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-slate-500 mt-0.5">
                    <span>{row.volume.toFixed(3)} m3</span>
                    <span>{row.weight.toFixed(1)} kg</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════

export function ResultDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const allContainers = useContainerStore((s) => s.items)
  const allItems = useItemStore((s) => s.items)

  const [result, setResult] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  // Lifted highlight state for 3D viewer + bottom sheet interaction
  const [highlightId, setHighlightId] = useState<number | null>(null)

  // Load result from IndexedDB
  useEffect(() => {
    if (!id) return
    db.simulationResults
      .get(Number(id))
      .then((r) => setResult(r ?? null))
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }, [id])

  // Lookups
  const containerMap = useMemo(() => {
    const m = new Map<number, ContainerType>()
    for (const c of allContainers) if (c.id != null) m.set(c.id, c)
    return m
  }, [allContainers])

  const itemMap = useMemo(() => {
    const m = new Map<number, ItemType>()
    for (const it of allItems) if (it.id != null) m.set(it.id, it)
    return m
  }, [allItems])

  const itemTypeInfos = useMemo(
    () => allItems.filter((it) => it.id != null).map((it) => ({ id: it.id!, name: it.name, color: it.color })),
    [allItems],
  )

  // ── Derived stats ─────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!result) return null
    const totalPacked = result.packedContainers.reduce(
      (s, pc) => s + pc.packedItems.reduce((ss, pi) => ss + pi.quantity, 0), 0,
    )
    const totalUnpacked = result.unpackedItems.reduce((s, u) => s + u.quantity, 0)
    return { totalPacked, totalUnpacked }
  }, [result])

  // ── Active container ──────────────────────────────────────────────

  const activeContainer = result?.packedContainers[activeTab] ?? null
  const activeContainerType = activeContainer ? containerMap.get(activeContainer.containerTypeId) ?? null : null

  // ── Per-item breakdown for sidebar ────────────────────────────────

  const itemBreakdown = useMemo(() => {
    if (!activeContainer) return []
    return activeContainer.packedItems.map((pi) => {
      const it = itemMap.get(pi.itemTypeId)
      const vol = it ? itemVol(it) * pi.quantity : 0
      const wt = it ? it.weightKg * pi.quantity : 0
      return {
        itemTypeId: pi.itemTypeId,
        name: it?.name ?? `Item #${pi.itemTypeId}`,
        color: it?.color ?? '#888',
        count: pi.quantity,
        volume: vol,
        weight: wt,
      }
    })
  }, [activeContainer, itemMap])

  // ── CBM used / total for active container ─────────────────────────

  const containerCBM = activeContainerType ? cbm(activeContainerType) : 0
  const usedCBM = activeContainer
    ? activeContainer.placedItems.reduce(
        (s, p) => s + p.placedLengthM * p.placedWidthM * p.placedHeightM, 0,
      )
    : 0

  // ── Container swipe handler ───────────────────────────────────────

  const handleSwipeContainer = useCallback((dir: 'prev' | 'next') => {
    if (!result) return
    setActiveTab((prev) => {
      if (dir === 'next') return Math.min(prev + 1, result.packedContainers.length - 1)
      return Math.max(prev - 1, 0)
    })
  }, [result])

  // ── What-if cost comparison ───────────────────────────────────────

  const whatIfRows = useMemo((): WhatIfRow[] => {
    if (!result) return []

    const allItemEntries: Array<{ itemType: ItemType; quantity: number }> = []
    for (const pc of result.packedContainers) {
      for (const pi of pc.packedItems) {
        const it = itemMap.get(pi.itemTypeId)
        if (it) allItemEntries.push({ itemType: it, quantity: pi.quantity })
      }
    }
    for (const ui of result.unpackedItems) {
      const it = itemMap.get(ui.itemTypeId)
      if (it) allItemEntries.push({ itemType: it, quantity: ui.quantity })
    }

    const merged = new Map<number, { itemType: ItemType; quantity: number }>()
    for (const e of allItemEntries) {
      const existing = merged.get(e.itemType.id!)
      if (existing) existing.quantity += e.quantity
      else merged.set(e.itemType.id!, { ...e })
    }
    const items = Array.from(merged.values())

    if (items.length === 0) return []

    const activeContainerTypes = allContainers.filter((c) => c.id != null && c.isActive)

    const currentRow: WhatIfRow = {
      label: 'Optimized Mix',
      containers: result.packedContainers.length,
      totalCost: result.totalCost,
      avgUtil: result.avgUtilization,
      costPerCBM: 0,
      isCurrent: true,
    }
    const currentTotalCBM = result.packedContainers.reduce((s, pc) => {
      const ct = containerMap.get(pc.containerTypeId)
      return s + (ct ? cbm(ct) : 0)
    }, 0)
    currentRow.costPerCBM = currentTotalCBM > 0 ? result.totalCost / currentTotalCBM : 0

    const rows: WhatIfRow[] = [currentRow]

    for (const ct of activeContainerTypes) {
      const input: PackingInput = {
        containerTypes: [ct],
        items,
      }
      try {
        const alt = packItems(input)
        const totalCBM = alt.packedContainers.length * cbm(ct)
        rows.push({
          label: `Only ${ct.name}`,
          containers: alt.packedContainers.length,
          totalCost: alt.totalCost,
          avgUtil: alt.avgUtilization,
          costPerCBM: totalCBM > 0 ? alt.totalCost / totalCBM : 0,
          isCurrent: false,
        })
      } catch {
        // skip if packing fails
      }
    }

    return rows
  }, [result, itemMap, allContainers, containerMap])

  // ── Actions ───────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    const url = window.location.href
    const text = `CBM Pack Optimizer — Result #${id}\nContainers: ${result?.packedContainers.length}, Cost: ${fmtINR(result?.totalCost ?? 0)}, Utilization: ${result?.avgUtilization.toFixed(1)}%`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pack Optimizer Result', text, url })
        return
      } catch {
        // user cancelled or not supported — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setShareError('Could not copy link')
      setTimeout(() => setShareError(null), 2000)
    }
  }, [id, result])

  const handleExportPDF = useCallback(() => {
    if (!result) return
    const blob = generatePDFBlob(result, containerMap, itemMap)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pack-result-${id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [result, containerMap, itemMap, id])

  // ── Loading / Not found ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading result...
        </div>
      </div>
    )
  }

  if (!result || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center">
          <ExclamationIcon className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-slate-400">Result not found.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-accent hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  const computedDate = result.computedAt instanceof Date ? result.computedAt : new Date(result.computedAt)

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-24 sm:pb-6">

      {/* ── Header + Actions ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-1"
          >
            <ArrowLeftIcon className="w-3 h-3" /> Dashboard
          </button>
          <h1 className="text-lg font-semibold text-slate-100">
            Simulation Result
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {computedDate.toLocaleDateString()} at {computedDate.toLocaleTimeString()}
            <span className="ml-2 text-emerald-500">Auto-saved</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/simulate')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-surface border border-border text-slate-300 hover:text-slate-100 hover:border-slate-600 transition-colors"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Back to Setup
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-surface border border-border text-slate-300 hover:text-slate-100 hover:border-slate-600 transition-colors"
          >
            {copied ? (
              <><CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> Copied!</>
            ) : shareError ? (
              <><ClipboardIcon className="w-3.5 h-3.5 text-red-400" /> {shareError}</>
            ) : (
              <><ShareIcon className="w-3.5 h-3.5" /> Share</>
            )}
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-colors"
          >
            <DocumentIcon className="w-3.5 h-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard
          label="Containers"
          value={String(result.packedContainers.length)}
          icon={<ContainerIcon className="w-4 h-4 text-slate-500" />}
        />
        <StatCard
          label="Total Cost"
          value={fmtINR(result.totalCost)}
          icon={<span className="text-xs text-slate-500">₹</span>}
        />
        <StatCard
          label="Avg Utilization"
          value={`${result.avgUtilization.toFixed(1)}%`}
          accent
        />
        <StatCard
          label="Items Packed"
          value={String(stats.totalPacked)}
          icon={<PackageIcon className="w-4 h-4 text-slate-500" />}
        />
        <StatCard
          label="Unpacked"
          value={String(stats.totalUnpacked)}
          warn={stats.totalUnpacked > 0}
        />
      </div>

      {/* ── Container tabs ────────────────────────────────────────── */}
      {result.packedContainers.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {result.packedContainers.map((pc, i) => {
            const ct = containerMap.get(pc.containerTypeId)
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeTab === i
                    ? 'bg-accent/20 text-accent border border-accent/40'
                    : 'bg-surface text-slate-400 border border-border hover:text-slate-200'
                }`}
              >
                {ct?.name ?? `Container ${i + 1}`}
                <span className="ml-1.5 text-[10px] opacity-70">
                  {pc.utilizationPct.toFixed(0)}%
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── 3D Viewer + Sidebar ───────────────────────────────────── */}
      {activeContainer && activeContainerType && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Viewer — 55vh min on mobile, 3/5 columns on desktop */}
          <div className="lg:col-span-3 min-h-[55vh] lg:min-h-0">
            <ContainerViewer3D
              container={{
                lengthM: activeContainerType.lengthM,
                widthM: activeContainerType.widthM,
                heightM: activeContainerType.heightM,
              }}
              packed={activeContainer}
              itemTypes={itemTypeInfos}
              highlightId={highlightId}
              onHighlightChange={setHighlightId}
              containerCount={result.packedContainers.length}
              activeIndex={activeTab}
              onSwipeContainer={handleSwipeContainer}
            />
          </div>

          {/* Sidebar — 40% on desktop (2/5 columns), hidden items on mobile (bottom sheet instead) */}
          <div className="lg:col-span-2 space-y-3">

            {/* Container info card */}
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">
                  {activeContainerType.name}
                </h3>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Container {activeTab + 1} of {result.packedContainers.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div className="text-slate-400">Dimensions</div>
                <div className="text-slate-200 text-right font-mono">
                  {activeContainerType.lengthM} × {activeContainerType.widthM} × {activeContainerType.heightM} m
                </div>

                <div className="text-slate-400">CBM Used / Total</div>
                <div className="text-slate-200 text-right font-mono">
                  {usedCBM.toFixed(2)} / {containerCBM.toFixed(2)} m³
                </div>

                <div className="text-slate-400">Weight Used / Max</div>
                <div className="text-slate-200 text-right font-mono">
                  {activeContainer.usedWeightKg.toFixed(1)} / {activeContainerType.maxWeightKg.toLocaleString()} kg
                </div>

                <div className="text-slate-400">Cost</div>
                <div className="text-slate-200 text-right font-mono">
                  {fmtINR(activeContainerType.costPerUnit)}
                </div>
              </div>

              {/* Utilization bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Volume Utilization</span>
                  <span className={
                    activeContainer.utilizationPct > 80 ? 'text-emerald-400'
                    : activeContainer.utilizationPct > 50 ? 'text-amber-400'
                    : 'text-red-400'
                  }>
                    {activeContainer.utilizationPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, activeContainer.utilizationPct)}%`,
                      backgroundColor:
                        activeContainer.utilizationPct > 80 ? '#22C55E'
                        : activeContainer.utilizationPct > 50 ? '#F59E0B'
                        : '#EF4444',
                    }}
                  />
                </div>
                {/* Weight bar */}
                <div className="flex justify-between text-[10px] mt-2">
                  <span className="text-slate-500">Weight Utilization</span>
                  <span className="text-slate-400">
                    {((activeContainer.usedWeightKg / activeContainerType.maxWeightKg) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/70 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (activeContainer.usedWeightKg / activeContainerType.maxWeightKg) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Packed items breakdown (desktop only — mobile uses bottom sheet) */}
            <div className="hidden md:block bg-surface border border-border rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-200">
                Packed Items
              </h3>
              <div className="space-y-2">
                {itemBreakdown.map((row) => {
                  const isActive = highlightId === null || highlightId === row.itemTypeId
                  return (
                    <button
                      key={row.itemTypeId}
                      type="button"
                      onClick={() => setHighlightId(highlightId === row.itemTypeId ? null : row.itemTypeId)}
                      className={`w-full flex items-start gap-2 text-xs text-left transition-opacity ${
                        isActive ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5"
                        style={{ backgroundColor: row.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 truncate">{row.name}</span>
                          <span className="text-slate-400 shrink-0 ml-2">x{row.count}</span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-slate-500 mt-0.5">
                          <span>{row.volume.toFixed(3)} m³</span>
                          <span>{row.weight.toFixed(1)} kg</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Cost per CBM card */}
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Cost per CBM (this container)
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">
                {containerCBM > 0
                  ? fmtINR(Math.round(activeContainerType.costPerUnit / containerCBM))
                  : '—'}
                <span className="text-xs text-slate-500 font-normal ml-1">/m³</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom sheet for item legend ────────────────────── */}
      {activeContainer && itemBreakdown.length > 0 && (
        <ItemBottomSheet
          itemBreakdown={itemBreakdown}
          highlightId={highlightId}
          onHighlightChange={setHighlightId}
        />
      )}

      {/* ── Unpacked items ────────────────────────────────────────── */}
      {result.unpackedItems.length > 0 && (
        <div className="bg-surface border border-amber-900/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ExclamationIcon className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-400">
              Unpacked Items ({stats.totalUnpacked})
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            These items could not fit in the available containers. Consider adding more containers or using larger sizes.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {result.unpackedItems.map((ui) => {
              const it = itemMap.get(ui.itemTypeId)
              return (
                <span
                  key={ui.itemTypeId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background border border-border rounded-md text-xs text-slate-300"
                >
                  <span
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: it?.color ?? '#888' }}
                  />
                  {it?.name ?? `Item #${ui.itemTypeId}`}
                  <span className="text-slate-500">x{ui.quantity}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Cost comparison what-if table ─────────────────────────── */}
      {whatIfRows.length > 1 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-slate-200">
              Cost Comparison — What If?
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              How costs change if you use only one container type vs. the optimized mix.
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Scenario</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Containers</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Total Cost</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Avg Util.</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Cost/CBM</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">vs Optimized</th>
                </tr>
              </thead>
              <tbody>
                {whatIfRows.map((row) => {
                  const diff = row.totalCost - whatIfRows[0].totalCost
                  const diffPct = whatIfRows[0].totalCost > 0
                    ? ((diff / whatIfRows[0].totalCost) * 100)
                    : 0
                  return (
                    <tr
                      key={row.label}
                      className={`border-b border-border/50 ${row.isCurrent ? 'bg-accent/5' : 'hover:bg-white/[0.02]'}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className={`${row.isCurrent ? 'text-accent font-medium' : 'text-slate-300'}`}>
                          {row.label}
                        </span>
                        {row.isCurrent && (
                          <span className="ml-2 text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded">
                            current
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-300 font-mono">{row.containers}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300 font-mono">{fmtINR(row.totalCost)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300 font-mono">{row.avgUtil.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right text-slate-300 font-mono">
                        {fmtINR(Math.round(row.costPerCBM))}/m³
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {row.isCurrent ? (
                          <span className="text-slate-500">—</span>
                        ) : diff > 0 ? (
                          <span className="text-red-400">+{fmtINR(diff)} (+{diffPct.toFixed(0)}%)</span>
                        ) : diff < 0 ? (
                          <span className="text-emerald-400">{fmtINR(diff)} ({diffPct.toFixed(0)}%)</span>
                        ) : (
                          <span className="text-slate-500">Same</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-border/50">
            {whatIfRows.map((row) => {
              const diff = row.totalCost - whatIfRows[0].totalCost
              const diffPct = whatIfRows[0].totalCost > 0
                ? ((diff / whatIfRows[0].totalCost) * 100)
                : 0
              return (
                <div
                  key={row.label}
                  className={`px-4 py-3 space-y-1.5 ${row.isCurrent ? 'bg-accent/5' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${row.isCurrent ? 'text-accent' : 'text-slate-300'}`}>
                      {row.label}
                    </span>
                    {row.isCurrent && (
                      <span className="text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded">current</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    <span className="text-slate-500">Containers</span>
                    <span className="text-slate-300 text-right font-mono">{row.containers}</span>
                    <span className="text-slate-500">Cost</span>
                    <span className="text-slate-300 text-right font-mono">{fmtINR(row.totalCost)}</span>
                    <span className="text-slate-500">Avg Util.</span>
                    <span className="text-slate-300 text-right font-mono">{row.avgUtil.toFixed(1)}%</span>
                    {!row.isCurrent && (
                      <>
                        <span className="text-slate-500">vs Optimized</span>
                        <span className={`text-right font-mono ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {diff > 0 ? `+${diffPct.toFixed(0)}%` : diff < 0 ? `${diffPct.toFixed(0)}%` : 'Same'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stat card ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  warn,
  icon,
}: {
  label: string
  value: string
  accent?: boolean
  warn?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </div>
      </div>
      <div
        className={`text-lg font-bold mt-1 ${
          warn
            ? 'text-amber-400'
            : accent
              ? 'text-accent'
              : 'text-slate-100'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
