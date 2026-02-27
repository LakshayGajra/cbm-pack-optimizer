import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSimulationStore } from '../store/simulationStore'
import { useContainerStore } from '../store/containerStore'
import {
  PlayIcon,
  ContainerIcon,
  PackageIcon,
  ChartBarIcon,
  ArrowRightIcon,
  CubeIcon,
} from '../components/icons'
import { useCurrencyFormatter, useCurrencySymbol } from '../lib/currency'
import type { SimulationResult, ContainerType } from '../types'

function timeAgo(d: Date): string {
  const now = Date.now()
  const then = d.getTime()
  const diffS = Math.floor((now - then) / 1000)
  if (diffS < 60) return 'just now'
  const diffM = Math.floor(diffS / 60)
  if (diffM < 60) return `${diffM}m ago`
  const diffH = Math.floor(diffM / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD}d ago`
  return d.toLocaleDateString()
}

function utilizationColor(pct: number): string {
  if (pct >= 75) return 'text-emerald-400'
  if (pct >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function utilizationBg(pct: number): string {
  if (pct >= 75) return '#22C55E'
  if (pct >= 50) return '#F59E0B'
  return '#EF4444'
}

// ── Component ───────────────────────────────────────────────────────────

export function Dashboard() {
  const results = useSimulationStore((s) => s.results)
  const configs = useSimulationStore((s) => s.configs)
  const allContainers = useContainerStore((s) => s.items)
  const fmt = useCurrencyFormatter()
  const currencySymbol = useCurrencySymbol()

  // Build lookup
  const containerMap = useMemo(() => {
    const m = new Map<number, ContainerType>()
    for (const c of allContainers) if (c.id != null) m.set(c.id, c)
    return m
  }, [allContainers])

  const configNameMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of configs) if (c.id != null) m.set(c.id, c.name)
    return m
  }, [configs])

  // Sort results newest first
  const sortedResults = useMemo(
    () =>
      [...results].sort((a, b) => {
        const da = a.computedAt instanceof Date ? a.computedAt.getTime() : new Date(a.computedAt).getTime()
        const db2 = b.computedAt instanceof Date ? b.computedAt.getTime() : new Date(b.computedAt).getTime()
        return db2 - da
      }),
    [results],
  )

  // ── Quick stats ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (results.length === 0) return null

    const totalSims = results.length
    const avgUtil =
      results.reduce((s, r) => s + r.avgUtilization, 0) / totalSims

    // Cost saved: sum of (naive cost - optimized cost) across all results
    // Naive = all items packed into the most expensive single container type
    let totalSaved = 0
    for (const r of results) {
      // Naive approach: use the largest (most expensive) container for each packed container
      const naiveCost = r.packedContainers.reduce((s, pc) => {
        const ct = containerMap.get(pc.containerTypeId)
        if (!ct) return s
        // Find the most expensive active container
        const maxCost = allContainers.reduce(
          (mx, c) => (c.isActive && c.costPerUnit > mx ? c.costPerUnit : mx),
          0,
        )
        return s + maxCost
      }, 0)
      totalSaved += Math.max(0, naiveCost - r.totalCost)
    }

    return { totalSims, avgUtil, totalSaved }
  }, [results, containerMap, allContainers])

  const hasResults = results.length > 0

  // ── Empty state ───────────────────────────────────────────────────

  if (!hasResults) {
    return <EmptyState />
  }

  // ── Main dashboard ────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of your packing simulations
          </p>
        </div>
        <Link
          to="/simulate"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <PlayIcon className="w-3.5 h-3.5" />
          New Simulation
        </Link>
      </div>

      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Total Simulations"
            value={String(stats.totalSims)}
            icon={<ChartBarIcon className="w-5 h-5" />}
            iconBg="bg-blue-500/15 text-blue-400"
          />
          <StatCard
            label="Avg Utilization"
            value={`${stats.avgUtil.toFixed(1)}%`}
            icon={<CubeIcon className="w-5 h-5" />}
            iconBg="bg-emerald-500/15 text-emerald-400"
            sub={
              <div className="mt-1.5 h-1.5 rounded-full bg-background overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, stats.avgUtil)}%`,
                    backgroundColor: utilizationBg(stats.avgUtil),
                  }}
                />
              </div>
            }
          />
          <StatCard
            label="Cost Saved (vs Naive)"
            value={fmt(stats.totalSaved)}
            icon={<span className="text-base font-bold">{currencySymbol}</span>}
            iconBg="bg-amber-500/15 text-amber-400"
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction
          to="/simulate"
          icon={<PlayIcon className="w-5 h-5" />}
          label="New Simulation"
          color="text-accent"
        />
        <QuickAction
          to="/configs"
          icon={<PackageIcon className="w-5 h-5" />}
          label="Manage Items"
          color="text-emerald-400"
        />
        <QuickAction
          to="/configs"
          icon={<ContainerIcon className="w-5 h-5" />}
          label="Manage Containers"
          color="text-blue-400"
        />
      </div>

      {/* Recent simulations */}
      <div>
        <h2 className="text-sm font-semibold text-slate-200 mb-3">
          Recent Simulations
        </h2>
        <div className="space-y-2">
          {sortedResults.slice(0, 10).map((r) => (
            <ResultCard
              key={r.id}
              result={r}
              containerMap={containerMap}
              configName={configNameMap.get(r.configId)}
            />
          ))}
        </div>
        {sortedResults.length > 10 && (
          <p className="text-xs text-slate-500 text-center mt-3">
            Showing 10 of {sortedResults.length} results
          </p>
        )}
      </div>
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Hero illustration */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <CubeIcon className="w-10 h-10 text-accent/60" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
          <span className="text-[10px] text-emerald-400">3D</span>
        </div>
      </div>

      <h1 className="text-xl font-semibold text-slate-100 mb-2">
        CBM Pack Optimizer
      </h1>
      <p className="text-sm text-slate-400 max-w-md mb-1">
        Optimize how items are packed into shipping containers.
        Define your container types and items, then run a simulation
        to find the most cost-effective packing arrangement.
      </p>
      <p className="text-xs text-slate-500 max-w-sm mb-8">
        Everything runs offline in your browser — no server needed.
        Data is stored locally in IndexedDB.
      </p>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg mb-8">
        <StepCard
          step={1}
          title="Configure"
          desc="Set up container types and item dimensions"
          icon={<AdjustmentsStepIcon />}
        />
        <StepCard
          step={2}
          title="Simulate"
          desc="Run the 3D bin-packing algorithm"
          icon={<PlayIcon className="w-5 h-5" />}
        />
        <StepCard
          step={3}
          title="Analyze"
          desc="View 3D results and cost comparisons"
          icon={<ChartBarIcon className="w-5 h-5" />}
        />
      </div>

      {/* CTA */}
      <Link
        to="/simulate"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
      >
        <PlayIcon className="w-4 h-4" />
        Create First Simulation
      </Link>

      {/* Quick links */}
      <div className="flex items-center gap-4 mt-5">
        <Link
          to="/configs"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Manage Configs
        </Link>
        <span className="text-slate-700">|</span>
        <Link
          to="/settings"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Settings
        </Link>
      </div>
    </div>
  )
}

function AdjustmentsStepIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
    </svg>
  )
}

function StepCard({
  step,
  title,
  desc,
  icon,
}: {
  step: number
  title: string
  desc: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 text-left">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center">
          {step}
        </span>
        <span className="text-slate-500">{icon}</span>
      </div>
      <h3 className="text-sm font-medium text-slate-200">{title}</h3>
      <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
    </div>
  )
}

// ── Stat card ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  iconBg,
  sub,
}: {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  sub?: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            {label}
          </div>
          <div className="text-xl font-bold text-slate-100">{value}</div>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      {sub}
    </div>
  )
}

// ── Quick action ────────────────────────────────────────────────────────

function QuickAction({
  to,
  icon,
  label,
  color,
}: {
  to: string
  icon: React.ReactNode
  label: string
  color: string
}) {
  return (
    <Link
      to={to}
      className="bg-surface border border-border rounded-lg p-3 flex flex-col items-center gap-1.5 hover:border-slate-600 transition-colors group"
    >
      <span className={`${color} group-hover:scale-110 transition-transform`}>
        {icon}
      </span>
      <span className="text-[11px] text-slate-400 font-medium text-center leading-tight">
        {label}
      </span>
    </Link>
  )
}

// ── Result card ─────────────────────────────────────────────────────────

function ResultCard({
  result,
  containerMap,
  configName,
}: {
  result: SimulationResult
  containerMap: Map<number, ContainerType>
  configName?: string
}) {
  const fmt = useCurrencyFormatter()
  const d = result.computedAt instanceof Date ? result.computedAt : new Date(result.computedAt)
  const containerNames = result.packedContainers
    .map((pc) => containerMap.get(pc.containerTypeId)?.name ?? 'Unknown')

  // Deduplicate container names with counts
  const nameCount = new Map<string, number>()
  for (const n of containerNames) nameCount.set(n, (nameCount.get(n) ?? 0) + 1)
  const containerSummary = Array.from(nameCount)
    .map(([name, count]) => (count > 1 ? `${count}× ${name}` : name))
    .join(', ')

  const totalItems = result.packedContainers.reduce(
    (s, pc) => s + pc.packedItems.reduce((ss, pi) => ss + pi.quantity, 0),
    0,
  )

  return (
    <Link
      to={`/results/${result.id}`}
      className="flex items-center gap-4 bg-surface border border-border rounded-lg p-4 hover:border-slate-600 transition-colors group"
    >
      {/* Utilization ring */}
      <div className="shrink-0 w-12 h-12 relative">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
          <circle
            cx="24" cy="24" r="20"
            fill="none"
            stroke="currentColor"
            className="text-white/5"
            strokeWidth="4"
          />
          <circle
            cx="24" cy="24" r="20"
            fill="none"
            stroke={utilizationBg(result.avgUtilization)}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(result.avgUtilization / 100) * 125.6} 125.6`}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${utilizationColor(result.avgUtilization)}`}>
          {result.avgUtilization.toFixed(0)}%
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200 truncate">
            {configName ?? `Simulation #${result.id}`}
          </span>
          <span className="text-[10px] text-slate-600 shrink-0">
            {timeAgo(d)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
          <span>{result.packedContainers.length} container{result.packedContainers.length !== 1 ? 's' : ''}</span>
          <span>{totalItems} items</span>
          <span>{fmt(result.totalCost)}</span>
        </div>
        <p className="text-[10px] text-slate-600 mt-0.5 truncate">
          {containerSummary}
        </p>
      </div>

      {/* Arrow */}
      <ArrowRightIcon className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
    </Link>
  )
}
