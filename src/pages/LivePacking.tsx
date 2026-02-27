import { useEffect, useReducer, useCallback, useMemo, useRef } from 'react'
import { useContainerStore } from '../store/containerStore'
import { useItemStore } from '../store/itemStore'
import { packItems } from '../lib/packing/engine'
import { LivePackingViewer, type AnimatedItem } from '../components/LivePackingViewer'
import { PlusIcon, TrashIcon } from '../components/icons'
import type { ContainerType, ItemType, PlacedItem } from '../types'

// ── State ──────────────────────────────────────────────────────────────

interface QueueItem {
  itemTypeId: number
  quantity: number
}

interface State {
  selectedContainerId: number | null
  queue: QueueItem[]
  // Packing result
  staticItems: PlacedItem[]        // items that are settled (not animating)
  animatingItems: AnimatedItem[]   // items currently falling
  // Stats
  utilizationPct: number
  usedWeightKg: number
  totalPacked: number
  totalUnpacked: number
  cost: number
}

type Action =
  | { type: 'SELECT_CONTAINER'; id: number }
  | { type: 'ADD_ITEMS'; itemTypeId: number; quantity: number }
  | { type: 'REMOVE_ITEM'; itemTypeId: number }
  | { type: 'SET_PACKING'; staticItems: PlacedItem[]; animatingItems: AnimatedItem[]; utilizationPct: number; usedWeightKg: number; totalPacked: number; totalUnpacked: number; cost: number }
  | { type: 'ANIMATIONS_DONE' }
  | { type: 'CLEAR_ALL' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SELECT_CONTAINER':
      return { ...state, selectedContainerId: action.id, queue: [], staticItems: [], animatingItems: [], utilizationPct: 0, usedWeightKg: 0, totalPacked: 0, totalUnpacked: 0, cost: 0 }
    case 'ADD_ITEMS': {
      const existing = state.queue.find(q => q.itemTypeId === action.itemTypeId)
      const newQueue = existing
        ? state.queue.map(q => q.itemTypeId === action.itemTypeId ? { ...q, quantity: q.quantity + action.quantity } : q)
        : [...state.queue, { itemTypeId: action.itemTypeId, quantity: action.quantity }]
      return { ...state, queue: newQueue }
    }
    case 'REMOVE_ITEM':
      return { ...state, queue: state.queue.filter(q => q.itemTypeId !== action.itemTypeId) }
    case 'SET_PACKING':
      return {
        ...state,
        staticItems: action.staticItems,
        animatingItems: action.animatingItems,
        utilizationPct: action.utilizationPct,
        usedWeightKg: action.usedWeightKg,
        totalPacked: action.totalPacked,
        totalUnpacked: action.totalUnpacked,
        cost: action.cost,
      }
    case 'ANIMATIONS_DONE':
      return {
        ...state,
        staticItems: [...state.staticItems, ...state.animatingItems.map(a => {
          const { animStartTime, animFromPz, animDone, ...placed } = a
          return placed
        })],
        animatingItems: [],
      }
    case 'CLEAR_ALL':
      return { ...state, queue: [], staticItems: [], animatingItems: [], utilizationPct: 0, usedWeightKg: 0, totalPacked: 0, totalUnpacked: 0, cost: 0 }
    default:
      return state
  }
}

const initialState: State = {
  selectedContainerId: null,
  queue: [],
  staticItems: [],
  animatingItems: [],
  utilizationPct: 0,
  usedWeightKg: 0,
  totalPacked: 0,
  totalUnpacked: 0,
  cost: 0,
}

// ── Component ──────────────────────────────────────────────────────────

export function LivePacking() {
  const containers = useContainerStore(s => s.items)
  const loadContainers = useContainerStore(s => s.loadAll)
  const itemTypes = useItemStore(s => s.items)
  const loadItems = useItemStore(s => s.loadAll)

  const [state, dispatch] = useReducer(reducer, initialState)

  // Form state for adding items
  const selectRef = useRef<HTMLSelectElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadContainers()
    loadItems()
  }, [loadContainers, loadItems])

  // Auto-select first container
  useEffect(() => {
    if (state.selectedContainerId === null && containers.length > 0) {
      const active = containers.find(c => c.isActive)
      if (active?.id) dispatch({ type: 'SELECT_CONTAINER', id: active.id })
    }
  }, [containers, state.selectedContainerId])

  const activeContainers = useMemo(() => containers.filter(c => c.isActive), [containers])
  const selectedContainer = useMemo(() => containers.find(c => c.id === state.selectedContainerId), [containers, state.selectedContainerId])

  const itemTypeMap = useMemo(() => {
    const m = new Map<number, ItemType & { id: number }>()
    for (const it of itemTypes) {
      if (it.id != null) m.set(it.id, it as ItemType & { id: number })
    }
    return m
  }, [itemTypes])

  // Item type info map for viewer (with required id)
  const viewerItemTypeMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; color: string; showItemCode?: boolean }>()
    for (const it of itemTypes) {
      if (it.id != null) m.set(it.id, { id: it.id, name: it.name, color: it.color, showItemCode: it.showItemCode })
    }
    return m
  }, [itemTypes])

  // Previous placed items ref to diff against
  const prevPlacedRef = useRef<PlacedItem[]>([])

  // ── Run packing on queue change ────────────────────────────────────

  const runPacking = useCallback((queue: QueueItem[], container: ContainerType, isRemoval: boolean) => {
    if (queue.length === 0) {
      prevPlacedRef.current = []
      dispatch({
        type: 'SET_PACKING',
        staticItems: [],
        animatingItems: [],
        utilizationPct: 0,
        usedWeightKg: 0,
        totalPacked: 0,
        totalUnpacked: 0,
        cost: 0,
      })
      return
    }

    const items: Array<{ itemType: ItemType; quantity: number }> = []
    for (const q of queue) {
      const itemType = itemTypeMap.get(q.itemTypeId)
      if (itemType) items.push({ itemType, quantity: q.quantity })
    }

    const result = packItems({
      containerTypes: [container],
      items,
    })

    const packed = result.packedContainers[0]
    if (!packed) {
      // Nothing fits
      const totalRequested = queue.reduce((s, q) => s + q.quantity, 0)
      prevPlacedRef.current = []
      dispatch({
        type: 'SET_PACKING',
        staticItems: [],
        animatingItems: [],
        utilizationPct: 0,
        usedWeightKg: 0,
        totalPacked: 0,
        totalUnpacked: totalRequested,
        cost: 0,
      })
      return
    }

    const newPlaced = packed.placedItems
    const totalRequested = queue.reduce((s, q) => s + q.quantity, 0)

    if (isRemoval) {
      // On removal, just set all items as static (no animation)
      prevPlacedRef.current = newPlaced
      dispatch({
        type: 'SET_PACKING',
        staticItems: newPlaced,
        animatingItems: [],
        utilizationPct: packed.utilizationPct,
        usedWeightKg: packed.usedWeightKg,
        totalPacked: newPlaced.length,
        totalUnpacked: totalRequested - newPlaced.length,
        cost: container.costPerUnit,
      })
    } else {
      // On addition, diff to find new items and animate them
      const prevCount = prevPlacedRef.current.length
      const staticItems = newPlaced.slice(0, prevCount)
      const newItems = newPlaced.slice(prevCount)
      const now = performance.now()

      const animatingItems: AnimatedItem[] = newItems.map((item, i) => ({
        ...item,
        animStartTime: now + i * 50, // stagger by 50ms
        animFromPz: container.heightM + 0.5, // start above container
        animDone: false,
      }))

      prevPlacedRef.current = newPlaced
      dispatch({
        type: 'SET_PACKING',
        staticItems,
        animatingItems,
        utilizationPct: packed.utilizationPct,
        usedWeightKg: packed.usedWeightKg,
        totalPacked: newPlaced.length,
        totalUnpacked: totalRequested - newPlaced.length,
        cost: container.costPerUnit,
      })
    }
  }, [itemTypeMap])

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleAddItems = useCallback(() => {
    const itemTypeId = Number(selectRef.current?.value)
    const qty = Number(qtyRef.current?.value) || 1
    if (!itemTypeId || !selectedContainer) return

    const existing = state.queue.find(q => q.itemTypeId === itemTypeId)
    const newQueue = existing
      ? state.queue.map(q => q.itemTypeId === itemTypeId ? { ...q, quantity: q.quantity + qty } : q)
      : [...state.queue, { itemTypeId, quantity: qty }]

    dispatch({ type: 'ADD_ITEMS', itemTypeId, quantity: qty })
    runPacking(newQueue, selectedContainer, false)

    if (qtyRef.current) qtyRef.current.value = '1'
  }, [state.queue, selectedContainer, runPacking])

  const handleRemoveItem = useCallback((itemTypeId: number) => {
    if (!selectedContainer) return
    const newQueue = state.queue.filter(q => q.itemTypeId !== itemTypeId)
    dispatch({ type: 'REMOVE_ITEM', itemTypeId })
    prevPlacedRef.current = [] // reset diff tracking on removal
    runPacking(newQueue, selectedContainer, true)
  }, [state.queue, selectedContainer, runPacking])

  const handleClearAll = useCallback(() => {
    prevPlacedRef.current = []
    dispatch({ type: 'CLEAR_ALL' })
  }, [])

  const handleContainerChange = useCallback((id: number) => {
    prevPlacedRef.current = []
    dispatch({ type: 'SELECT_CONTAINER', id })
  }, [])

  const handleAnimationsDone = useCallback(() => {
    dispatch({ type: 'ANIMATIONS_DONE' })
  }, [])

  const maxWeightKg = selectedContainer?.maxWeightKg ?? 0
  const weightPct = maxWeightKg > 0 ? (state.usedWeightKg / maxWeightKg) * 100 : 0

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <h1 className="text-base font-semibold text-white">Live Packing</h1>
        <select
          value={state.selectedContainerId ?? ''}
          onChange={e => handleContainerChange(Number(e.target.value))}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent max-w-[10rem] sm:max-w-xs"
        >
          {activeContainers.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.lengthM}x{c.widthM}x{c.heightM}m)
            </option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 3D Viewer */}
        <div className="md:flex-[3] p-4 sm:p-6 min-h-0">
          {selectedContainer ? (
            <LivePackingViewer
              container={selectedContainer}
              placedItems={state.staticItems}
              animatedItems={state.animatingItems}
              itemTypeMap={viewerItemTypeMap}
              onAnimationsDone={handleAnimationsDone}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Select a container to begin
            </div>
          )}
        </div>

        {/* Item Panel */}
        <div className="md:flex-[2] border-t md:border-t-0 md:border-l border-border flex flex-col min-h-0">
          {/* Add Items Form */}
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-slate-300 mb-3">Add Items</h2>
            <div className="flex gap-2">
              <select
                ref={selectRef}
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent min-w-0"
              >
                {itemTypes.filter(it => it.id != null).map(it => (
                  <option key={it.id} value={it.id}>{it.name}</option>
                ))}
              </select>
              <input
                ref={qtyRef}
                type="number"
                min={1}
                max={999}
                defaultValue={1}
                className="w-16 bg-surface border border-border rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleAddItems}
                disabled={!selectedContainer || itemTypes.length === 0}
                className="flex items-center gap-1 px-3 py-2 bg-accent hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
          </div>

          {/* Items Queue */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-300">Items Queue</h2>
              {state.queue.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {state.queue.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-8">
                No items added yet. Select an item type and click Add.
              </p>
            ) : (
              <div className="space-y-2">
                {state.queue.map(q => {
                  const info = itemTypeMap.get(q.itemTypeId)
                  if (!info) return null
                  return (
                    <div
                      key={q.itemTypeId}
                      className="flex items-center gap-3 px-3 py-2 bg-surface rounded-lg border border-border min-w-0"
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: info.color }}
                      />
                      <span className="flex-1 text-sm text-white truncate">{info.name}</span>
                      <span className="text-sm text-slate-400 tabular-nums">x{q.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(q.itemTypeId)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-t border-border bg-surface/50 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-6 gap-y-2 text-xs">
          {/* Volume utilization */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Vol:</span>
            <div className="w-12 sm:w-20 h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, state.utilizationPct)}%` }}
              />
            </div>
            <span className="text-white font-medium tabular-nums">{state.utilizationPct.toFixed(1)}%</span>
          </div>

          {/* Weight utilization */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Wt:</span>
            <div className="w-12 sm:w-20 h-2 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${weightPct > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, weightPct)}%` }}
              />
            </div>
            <span className="text-white font-medium tabular-nums">{weightPct.toFixed(1)}%</span>
          </div>

          {/* Item counts */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Items:</span>
            <span className="text-white font-medium tabular-nums">{state.totalPacked} packed</span>
            {state.totalUnpacked > 0 && (
              <span className="text-red-400 font-medium tabular-nums">, {state.totalUnpacked} left</span>
            )}
          </div>

          {/* Cost */}
          {state.totalPacked > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Cost:</span>
              <span className="text-white font-medium tabular-nums">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(state.cost)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
