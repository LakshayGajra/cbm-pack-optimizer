import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import type { ContainerType, ItemType, PackingInput, PackingProgress, SimulationConfig } from '../types'
import { useContainerStore } from '../store/containerStore'
import { useItemStore } from '../store/itemStore'
import { useSimulationStore } from '../store/simulationStore'
import { runPacking } from '../lib/packing'
import { db } from '../db'
import {
  ContainerIcon,
  PackageIcon,
  PlayIcon,
  BookmarkIcon,
  CheckIcon,
  XMarkIcon,
} from '../components/icons'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QtyMap = Record<number, number>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtINR(n: number) {
  return n.toLocaleString('en-IN')
}

function cbmOf(c: ContainerType) {
  return c.lengthM * c.widthM * c.heightM
}

function itemVolume(it: ItemType) {
  return it.lengthM * it.widthM * it.heightM
}

// ---------------------------------------------------------------------------
// Save Config dialog
// ---------------------------------------------------------------------------

interface SaveConfigDialogProps {
  open: boolean
  isSaving: boolean
  onClose: () => void
  onSave: (name: string) => void
}

function SaveConfigDialog({ open, isSaving, onClose, onSave }: SaveConfigDialogProps) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setErr('')
    }
  }, [open])

  function handleSave() {
    if (!name.trim()) {
      setErr('Name is required')
      return
    }
    onSave(name.trim())
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <BookmarkIcon className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">Save Configuration</h3>
            <p className="text-white/40 text-xs mt-0.5">Reuse this setup later as a quick-load preset</p>
          </div>
        </div>

        <label className="block text-xs font-medium text-white/50 mb-1.5">
          Config Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          autoFocus
          placeholder="e.g. Electronics Export"
          onChange={(e) => {
            setName(e.target.value)
            setErr('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') onClose()
          }}
          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-accent/60 transition-colors"
        />
        {err && <p className="mt-1 text-xs text-red-400">{err}</p>}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isSaving ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Run progress overlay
// ---------------------------------------------------------------------------

function RunProgressOverlay({ progress }: { progress: PackingProgress | null }) {
  const pct = progress?.percent ?? 0

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-6">
        {/* Pulsing icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center">
              <ContainerIcon className="w-8 h-8 text-accent" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-accent/30 animate-ping" />
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-white font-semibold">Running Simulation</p>
          <p className="text-white/40 text-sm">
            {progress
              ? `${progress.placedCount} of ${progress.totalCount} items placed`
              : 'Initialising packing engine…'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/30">
            <span>0%</span>
            <span className="text-accent font-semibold">{pct}%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Container selection card
// ---------------------------------------------------------------------------

interface ContainerCardProps {
  container: ContainerType
  checked: boolean
  onChange: (id: number, checked: boolean) => void
}

function ContainerCard({ container, checked, onChange }: ContainerCardProps) {
  const vol = cbmOf(container)
  const id = container.id!

  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all select-none ${
        checked
          ? 'border-accent/50 bg-accent/[0.08]'
          : 'border-border hover:border-white/20 hover:bg-white/[0.02]'
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(id, e.target.checked)}
      />
      {/* Custom checkbox */}
      <div
        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked ? 'bg-accent border-accent' : 'border-white/30'
        }`}
      >
        {checked && <CheckIcon className="w-3 h-3 text-white" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-medium text-sm leading-snug ${checked ? 'text-white' : 'text-white/75'}`}>
            {container.name}
          </p>
          <p className="text-accent text-sm font-semibold shrink-0">₹{fmtINR(container.costPerUnit)}</p>
        </div>
        <p className="text-white/35 text-xs mt-1 font-mono">
          {container.lengthM} × {container.widthM} × {container.heightM} m
        </p>
        <div className="flex gap-3 mt-1.5">
          <span className="text-[11px] text-white/40">{vol.toFixed(2)} m³</span>
          <span className="text-[11px] text-white/40">{fmtINR(container.maxWeightKg)} kg cap.</span>
        </div>
      </div>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Item quantity row
// ---------------------------------------------------------------------------

interface ItemRowProps {
  item: ItemType
  quantity: number
  onChange: (qty: number) => void
}

function ItemRow({ item, quantity, onChange }: ItemRowProps) {
  const active = quantity > 0

  function clamp(v: number) {
    return Math.max(0, Math.round(v))
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        active ? 'border-accent/30 bg-accent/[0.05]' : 'border-border'
      }`}
    >
      <div
        className="w-8 h-8 rounded-lg border border-white/10 shrink-0"
        style={{ background: item.color }}
      />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${active ? 'text-white' : 'text-white/65'}`}>
          {item.name}
        </p>
        <p className="text-[11px] text-white/30 font-mono mt-0.5">
          {item.lengthM} × {item.widthM} × {item.heightM} m · {item.weightKg} kg
        </p>
      </div>

      {/* Quantity stepper */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={() => onChange(clamp(quantity - 1))}
          disabled={quantity === 0}
          aria-label="Decrease quantity"
          className="w-8 h-8 flex items-center justify-center border border-border rounded-l-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors font-medium"
        >
          −
        </button>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => onChange(clamp(parseInt(e.target.value) || 0))}
          aria-label={`Quantity for ${item.name}`}
          className="w-12 h-8 text-center border-y border-border bg-background text-white text-sm font-mono focus:outline-none focus:border-y-accent/60 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(quantity + 1))}
          aria-label="Increase quantity"
          className="w-8 h-8 flex items-center justify-center border border-border rounded-r-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors font-medium"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Saved config preset chip
// ---------------------------------------------------------------------------

function PresetChip({
  config,
  onLoad,
  onDelete,
}: {
  config: SimulationConfig
  onLoad: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-1 bg-surface border border-border hover:border-white/20 rounded-lg pl-3 pr-1.5 py-1.5 transition-colors">
      <button
        onClick={onLoad}
        className="text-sm text-white/60 hover:text-white transition-colors flex-1 text-left leading-none"
      >
        {config.name}
      </button>
      <button
        onClick={onDelete}
        title="Remove preset"
        className="p-0.5 rounded text-white/20 hover:text-red-400 transition-colors shrink-0"
      >
        <XMarkIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sticky summary bar
// ---------------------------------------------------------------------------

interface SummaryBarProps {
  totalItems: number
  totalVolume: number
  totalWeight: number
  canRun: boolean
  isRunning: boolean
  error: string | null
  onSaveConfig: () => void
  onRun: () => void
}

function SummaryBar({
  totalItems,
  totalVolume,
  totalWeight,
  canRun,
  isRunning,
  error,
  onSaveConfig,
  onRun,
}: SummaryBarProps) {
  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 md:left-56 right-0 z-30 bg-surface/95 backdrop-blur-sm border-t border-border">
      {error && (
        <div className="px-4 sm:px-6 py-2 bg-red-500/10 border-b border-red-500/20">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Stats */}
        <div className="flex gap-5 flex-1 min-w-0">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider leading-none mb-1">Items</p>
            <p className={`text-sm font-bold tabular-nums ${totalItems > 0 ? 'text-white' : 'text-white/20'}`}>
              {totalItems}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider leading-none mb-1">Volume</p>
            <p className={`text-sm font-bold tabular-nums font-mono ${totalVolume > 0 ? 'text-white' : 'text-white/20'}`}>
              {totalVolume.toFixed(3)} m³
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider leading-none mb-1">Weight</p>
            <p className={`text-sm font-bold tabular-nums font-mono ${totalWeight > 0 ? 'text-white' : 'text-white/20'}`}>
              {totalWeight.toFixed(1)} kg
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onSaveConfig}
            disabled={isRunning || !canRun}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <BookmarkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Save Config</span>
            <span className="sm:hidden">Save</span>
          </button>
          <button
            onClick={onRun}
            disabled={!canRun || isRunning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-35 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
          >
            <PlayIcon className="w-4 h-4" />
            Run Simulation
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state helper
// ---------------------------------------------------------------------------

function EmptyPrompt({ type }: { type: 'containers' | 'items' }) {
  const label = type === 'containers' ? 'active container types' : 'item types'
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-border flex items-center justify-center mb-3">
        {type === 'containers' ? (
          <ContainerIcon className="w-5 h-5 text-white/20" />
        ) : (
          <PackageIcon className="w-5 h-5 text-white/20" />
        )}
      </div>
      <p className="text-white/35 text-sm mb-2">No {label} found</p>
      <Link
        to="/configs"
        className="text-accent text-sm hover:text-accent/80 transition-colors underline underline-offset-2"
      >
        Add {type === 'containers' ? 'containers' : 'items'} in Config →
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function NewSimulation() {
  const navigate = useNavigate()
  const containerStore = useContainerStore()
  const itemStore = useItemStore()
  const simStore = useSimulationStore()

  const activeContainers = containerStore.items.filter((c) => c.isActive)
  const allItems = itemStore.items
  const savedConfigs = simStore.configs

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [quantities, setQuantities] = useState<QtyMap>({})
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<PackingProgress | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // Derived totals
  const activeQtyEntries = Object.entries(quantities).filter(([, q]) => q > 0)

  const totalItems = activeQtyEntries.reduce((s, [, q]) => s + q, 0)

  const totalVolume = activeQtyEntries.reduce((s, [idStr, q]) => {
    const it = allItems.find((i) => i.id === Number(idStr))
    return s + (it ? itemVolume(it) * q : 0)
  }, 0)

  const totalWeight = activeQtyEntries.reduce((s, [idStr, q]) => {
    const it = allItems.find((i) => i.id === Number(idStr))
    return s + (it ? it.weightKg * q : 0)
  }, 0)

  const canRun = selectedIds.size > 0 && totalItems > 0

  // ---- Handlers ----

  function toggleContainer(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function setQty(itemId: number, qty: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: qty }))
  }

  function loadConfig(cfg: SimulationConfig) {
    setSelectedIds(new Set(cfg.containerTypes.map((ct) => ct.containerTypeId)))
    const qtys: QtyMap = {}
    for (const { itemTypeId, quantity } of cfg.items) {
      qtys[itemTypeId] = quantity
    }
    setQuantities(qtys)
  }

  async function handleSaveConfig(name: string) {
    setIsSavingConfig(true)
    try {
      await simStore.addConfig({
        name,
        containerTypes: Array.from(selectedIds).map((id) => ({ containerTypeId: id, quantity: 1 })),
        items: activeQtyEntries.map(([idStr, qty]) => ({
          itemTypeId: Number(idStr),
          quantity: qty,
        })),
      })
      setSaveOpen(false)
    } finally {
      setIsSavingConfig(false)
    }
  }

  async function handleRun() {
    if (!canRun) return
    setRunError(null)
    setIsRunning(true)
    setProgress(null)

    try {
      const selectedContainers = activeContainers.filter((c) => selectedIds.has(c.id!))
      const itemsForPacking: PackingInput['items'] = activeQtyEntries.map(([idStr, qty]) => ({
        itemType: allItems.find((i) => i.id === Number(idStr))!,
        quantity: qty,
      }))

      const result = await runPacking({
        input: { containerTypes: selectedContainers, items: itemsForPacking },
        configId: 0,
        onProgress: (p) => setProgress(p),
      })

      // Insert directly to get auto-increment key for navigation
      const newId = await db.simulationResults.add(result)
      await simStore.loadAll()
      navigate(`/results/${String(newId)}`)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Simulation failed')
      setIsRunning(false)
    }
  }

  // ---- Render ----

  return (
    <>
      <div className="max-w-7xl mx-auto pb-44 sm:pb-40 md:pb-28">
        {/* Page header + presets */}
        <div className="px-4 sm:px-6 py-6 border-b border-border">
          <h1 className="text-xl font-bold text-white">New Simulation</h1>
          <p className="text-sm text-white/40 mt-1">
            Choose container types and specify item quantities, then run the packing engine.
          </p>

          {savedConfigs.length > 0 && (
            <div className="mt-5">
              <p className="flex items-center gap-1.5 text-xs text-white/30 uppercase tracking-wider mb-2">
                <BookmarkIcon className="w-3.5 h-3.5" />
                Quick-load presets
              </p>
              <div className="flex flex-wrap gap-2">
                {savedConfigs.map((cfg) => (
                  <PresetChip
                    key={cfg.id}
                    config={cfg}
                    onLoad={() => loadConfig(cfg)}
                    onDelete={() => simStore.removeConfig(cfg.id!)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 md:p-6">
          {/* Left — Containers */}
          <section>
            <div className="flex items-center gap-2 px-4 sm:px-6 md:px-0 pt-5 pb-3 md:pt-0">
              <ContainerIcon className="w-4 h-4 text-accent/60" />
              <h2 className="text-sm font-semibold text-white">Select Containers</h2>
              {selectedIds.size > 0 && (
                <span className="ml-auto text-xs text-accent font-medium">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
            <p className="text-xs text-white/30 px-4 sm:px-6 md:px-0 -mt-1 mb-3">
              The algorithm fills as many containers as needed from the selected types.
            </p>

            <div className="px-4 sm:px-6 md:px-0 space-y-2.5 pb-6">
              {activeContainers.length === 0 ? (
                <EmptyPrompt type="containers" />
              ) : (
                activeContainers.map((c) => (
                  <ContainerCard
                    key={c.id}
                    container={c}
                    checked={selectedIds.has(c.id!)}
                    onChange={toggleContainer}
                  />
                ))
              )}
            </div>
          </section>

          {/* Divider (mobile only) */}
          <div className="md:hidden h-px bg-border" />

          {/* Right — Items */}
          <section>
            <div className="flex items-center gap-2 px-4 sm:px-6 md:px-0 pt-5 pb-3 md:pt-0">
              <PackageIcon className="w-4 h-4 text-accent/60" />
              <h2 className="text-sm font-semibold text-white">Items to Pack</h2>
              {totalItems > 0 && (
                <span className="ml-auto text-xs text-accent font-medium">
                  {totalItems} total
                </span>
              )}
            </div>
            <p className="text-xs text-white/30 px-4 sm:px-6 md:px-0 -mt-1 mb-3">
              Set quantity to 0 to exclude an item type from this run.
            </p>

            <div className="px-4 sm:px-6 md:px-0 space-y-2 pb-6">
              {allItems.length === 0 ? (
                <EmptyPrompt type="items" />
              ) : (
                allItems.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    quantity={quantities[it.id!] ?? 0}
                    onChange={(q) => setQty(it.id!, q)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Full-screen progress overlay */}
      {isRunning && <RunProgressOverlay progress={progress} />}

      {/* Save Config dialog */}
      <SaveConfigDialog
        open={saveOpen}
        isSaving={isSavingConfig}
        onClose={() => setSaveOpen(false)}
        onSave={handleSaveConfig}
      />

      {/* Sticky summary + actions bar */}
      <SummaryBar
        totalItems={totalItems}
        totalVolume={totalVolume}
        totalWeight={totalWeight}
        canRun={canRun}
        isRunning={isRunning}
        error={runError}
        onSaveConfig={() => setSaveOpen(true)}
        onRun={handleRun}
      />
    </>
  )
}
