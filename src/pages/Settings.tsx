import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../db'
import { useContainerStore } from '../store/containerStore'
import { useItemStore } from '../store/itemStore'
import { useSimulationStore } from '../store/simulationStore'
import { useSettingsStore, CURRENCIES } from '../store/settingsStore'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { ContainerType, ItemType, SimulationConfig, SimulationResult } from '../types'

// ── Types ───────────────────────────────────────────────────────────────

interface BackupData {
  version: number
  exportedAt: string
  containers: ContainerType[]
  items: ItemType[]
  configs: SimulationConfig[]
  results: SimulationResult[]
}

// ── Helpers ─────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isValidBackup(data: unknown): data is BackupData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    typeof d.version === 'number' &&
    Array.isArray(d.containers) &&
    Array.isArray(d.items) &&
    Array.isArray(d.configs) &&
    Array.isArray(d.results)
  )
}

// ── Section wrapper ─────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════

export function Settings() {
  const containerStore = useContainerStore()
  const itemStore = useItemStore()
  const simStore = useSimulationStore()
  const { currency, setCurrency } = useSettingsStore()

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Data management state ───────────────────────────────────────────
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<BackupData | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // ── Storage info ────────────────────────────────────────────────────
  const [storageUsed, setStorageUsed] = useState<number | null>(null)
  const [storageQuota, setStorageQuota] = useState<number | null>(null)

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        setStorageUsed(est.usage ?? null)
        setStorageQuota(est.quota ?? null)
      })
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Export ──────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const [containers, items, configs, results] = await Promise.all([
        db.containerTypes.toArray(),
        db.itemTypes.toArray(),
        db.simulationConfigs.toArray(),
        db.simulationResults.toArray(),
      ])
      const backup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        containers,
        items,
        configs,
        results,
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cbm-backup-${today()}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Data exported successfully')
    } catch (err) {
      showToast(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setExporting(false)
    }
  }, [showToast])

  // ── Import ─────────────────────────────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (!isValidBackup(data)) {
          showToast('Invalid backup file format')
          return
        }
        setImportPreview(data)
      } catch {
        showToast('Could not parse file — must be valid JSON')
      }
    }
    reader.readAsText(file)
    // Reset so the same file can be selected again
    e.target.value = ''
  }, [showToast])

  const handleImportConfirm = useCallback(async () => {
    if (!importPreview) return
    setImporting(true)
    try {
      await db.transaction(
        'rw',
        [db.containerTypes, db.itemTypes, db.simulationConfigs, db.simulationResults],
        async () => {
          await db.containerTypes.clear()
          await db.itemTypes.clear()
          await db.simulationConfigs.clear()
          await db.simulationResults.clear()
          if (importPreview.containers.length) await db.containerTypes.bulkPut(importPreview.containers)
          if (importPreview.items.length) await db.itemTypes.bulkPut(importPreview.items)
          if (importPreview.configs.length) await db.simulationConfigs.bulkPut(importPreview.configs)
          if (importPreview.results.length) await db.simulationResults.bulkPut(importPreview.results)
        },
      )
      await Promise.all([
        containerStore.loadAll(),
        itemStore.loadAll(),
        simStore.loadAll(),
      ])
      showToast(`Imported ${importPreview.containers.length} containers, ${importPreview.items.length} items, ${importPreview.results.length} results`)
    } catch (err) {
      showToast(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setImporting(false)
      setImportPreview(null)
    }
  }, [importPreview, containerStore, itemStore, simStore, showToast])

  // ── Clear ──────────────────────────────────────────────────────────
  const handleClear = useCallback(async () => {
    try {
      await db.transaction(
        'rw',
        [db.containerTypes, db.itemTypes, db.simulationConfigs, db.simulationResults],
        async () => {
          await db.containerTypes.clear()
          await db.itemTypes.clear()
          await db.simulationConfigs.clear()
          await db.simulationResults.clear()
        },
      )
      await Promise.all([
        containerStore.loadAll(),
        itemStore.loadAll(),
        simStore.loadAll(),
      ])
      showToast('All data cleared')
    } catch (err) {
      showToast(`Clear failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setShowClearConfirm(false)
    }
  }, [containerStore, itemStore, simStore, showToast])

  // ── Counts ─────────────────────────────────────────────────────────
  const containerCount = containerStore.items.length
  const itemCount = itemStore.items.length
  const resultCount = simStore.results.length
  const configCount = simStore.configs.length

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5 pb-24 md:pb-6">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-white/40 mt-1">Manage your data, currency, and preferences</p>
      </div>

      {/* ─── Currency ──────────────────────────────────────────────── */}
      <Section title="Currency" description="Used across all cost displays and reports">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setCurrency(c.code)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                currency === c.code
                  ? 'border-accent/50 bg-accent/[0.08] text-white'
                  : 'border-border hover:border-white/20 text-white/60 hover:text-white'
              }`}
            >
              <span className="text-lg leading-none w-6 text-center shrink-0">{c.symbol}</span>
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{c.code}</div>
                <div className="text-[10px] text-white/30 truncate">{c.label}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* ─── Data Management ───────────────────────────────────────── */}
      <Section title="Data Management" description="Export, import, or clear all locally stored data">
        <div className="space-y-3">
          {/* Export */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Export All Data</p>
              <p className="text-xs text-white/30 mt-0.5">
                Download containers, items, configs &amp; results as JSON
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 rounded-xl bg-accent/15 border border-accent/30 text-accent text-sm font-medium hover:bg-accent/25 disabled:opacity-50 transition-colors shrink-0"
            >
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>

          <div className="h-px bg-border/60" />

          {/* Import */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Import Data</p>
              <p className="text-xs text-white/30 mt-0.5">
                Restore from a previously exported JSON backup
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl border border-border text-white/60 text-sm font-medium hover:text-white hover:border-white/30 transition-colors shrink-0"
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Select backup file to import"
            />
          </div>

          <div className="h-px bg-border/60" />

          {/* Clear */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-400">Clear All Data</p>
              <p className="text-xs text-white/30 mt-0.5">
                Permanently delete all containers, items, and simulation results
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 hover:border-red-500/50 transition-colors shrink-0"
            >
              Clear
            </button>
          </div>
        </div>
      </Section>

      {/* ─── About & Storage ───────────────────────────────────────── */}
      <Section title="About">
        <div className="space-y-3 text-sm">
          {/* Data counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Containers" value={containerCount} />
            <MiniStat label="Item Types" value={itemCount} />
            <MiniStat label="Saved Configs" value={configCount} />
            <MiniStat label="Simulations" value={resultCount} />
          </div>

          <div className="h-px bg-border/60" />

          {/* Storage */}
          {storageUsed !== null && (
            <div className="flex items-center justify-between">
              <span className="text-white/50">Storage Used</span>
              <span className="text-white font-mono text-xs">
                {fmtBytes(storageUsed)}
                {storageQuota !== null && ` / ${fmtBytes(storageQuota)}`}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-white/50">Offline Ready</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              PWA + Service Worker
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-white/50">Data Storage</span>
            <span className="text-white/70 text-xs">IndexedDB (local, offline)</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-white/50">Version</span>
            <span className="text-white/70 font-mono text-xs">1.0.0</span>
          </div>
        </div>
      </Section>

      {/* ─── Import preview confirmation ───────────────────────────── */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setImportPreview(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          >
            <h3 id="import-title" className="text-white font-semibold text-base mb-2">Import Backup</h3>
            <p className="text-white/50 text-sm mb-4">
              This will <span className="text-red-400 font-medium">replace all existing data</span> with:
            </p>
            <div className="grid grid-cols-2 gap-2 mb-5 text-sm">
              <div className="bg-background rounded-lg px-3 py-2">
                <div className="text-white font-medium">{importPreview.containers.length}</div>
                <div className="text-[10px] text-white/30 uppercase">Containers</div>
              </div>
              <div className="bg-background rounded-lg px-3 py-2">
                <div className="text-white font-medium">{importPreview.items.length}</div>
                <div className="text-[10px] text-white/30 uppercase">Items</div>
              </div>
              <div className="bg-background rounded-lg px-3 py-2">
                <div className="text-white font-medium">{importPreview.configs.length}</div>
                <div className="text-[10px] text-white/30 uppercase">Configs</div>
              </div>
              <div className="bg-background rounded-lg px-3 py-2">
                <div className="text-white font-medium">{importPreview.results.length}</div>
                <div className="text-[10px] text-white/30 uppercase">Results</div>
              </div>
            </div>
            {importPreview.exportedAt && (
              <p className="text-xs text-white/30 mb-4">
                Exported: {new Date(importPreview.exportedAt).toLocaleString()}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportConfirm}
                disabled={importing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {importing ? 'Importing…' : 'Replace & Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Clear confirmation ────────────────────────────────────── */}
      <ConfirmDialog
        open={showClearConfirm}
        title="Clear All Data"
        message="This will permanently delete all containers, items, saved configs, and simulation results. This action cannot be undone. Consider exporting a backup first."
        confirmLabel="Clear Everything"
        onConfirm={handleClear}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* ─── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-surface border border-border rounded-xl shadow-2xl text-sm text-white animate-[fadeIn_150ms_ease-out]">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Mini stat ───────────────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background rounded-xl px-3 py-2.5 text-center">
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
      <div className="text-[10px] text-white/30 uppercase tracking-wider">{label}</div>
    </div>
  )
}
