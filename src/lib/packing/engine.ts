import type {
  ContainerType,
  ItemType,
  PackedContainer,
  PackingInput,
  PackingProgress,
  PlacedItem,
  SimulationResult,
} from '../../types'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** A free rectangular space inside a container */
interface Space {
  x: number
  y: number
  z: number
  w: number // width  (along x)
  d: number // depth  (along y)
  h: number // height (along z)
}

/** Flat item descriptor expanded from quantity arrays */
interface FlatItem {
  itemType: ItemType
  index: number // original position for stable sort
}

/** All 6 axis-aligned rotations of a box: [lengthM, widthM, heightM] */
function rotations(l: number, w: number, h: number): [number, number, number][] {
  return [
    [l, w, h], // 0
    [l, h, w], // 1
    [w, l, h], // 2
    [w, h, l], // 3
    [h, l, w], // 4
    [h, w, l], // 5
  ]
}

// ---------------------------------------------------------------------------
// Stacking helpers
// ---------------------------------------------------------------------------

/** Returns true if `candidate` would violate stacking rules of items below. */
function violatesStacking(
  candidate: ItemType,
  pz: number,
  placedItems: PlacedItem[],
  itemLookup: Map<number, ItemType>,
): boolean {
  // Only matters when the candidate is placed above the floor
  if (pz === 0) return false

  const candidateBottom = pz

  for (const placed of placedItems) {
    const placedTop = placed.pz + placed.placedHeightM

    // Is this placed item directly beneath the candidate?
    // Check vertical adjacency (within small epsilon)
    if (Math.abs(placedTop - candidateBottom) > 0.001) continue

    const below = itemLookup.get(placed.itemTypeId)
    if (!below) continue

    // Fragile items cannot have anything on top
    if (below.isFragile) return true

    // Stackable items: the weight of everything above must not exceed maxStackWeightKg
    if (below.isStackable && below.maxStackWeightKg > 0) {
      // Approximate: just check the candidate weight against the limit
      if (candidate.weightKg > below.maxStackWeightKg) return true
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// Single-container packing (guillotine + extreme-point)
// ---------------------------------------------------------------------------

interface ContainerPackResult {
  placedItems: PlacedItem[]
  usedWeightKg: number
  utilizationPct: number
}

function packIntoContainer(
  container: ContainerType,
  items: FlatItem[],
  itemLookup: Map<number, ItemType>,
): { result: ContainerPackResult; remainingItems: FlatItem[] } {
  const cW = container.lengthM
  const cD = container.widthM
  const cH = container.heightM
  const maxWeight = container.maxWeightKg

  const placed: PlacedItem[] = []
  let usedWeight = 0
  const containerVolume = cW * cD * cH

  // Start with one space that is the entire container
  let spaces: Space[] = [{ x: 0, y: 0, z: 0, w: cW, d: cD, h: cH }]

  const remaining: FlatItem[] = []

  for (const flatItem of items) {
    const it = flatItem.itemType
    const rots = rotations(it.lengthM, it.widthM, it.heightM)
    let didPlace = false

    // Try each space (sorted: prefer lower z, then lower y, then lower x)
    spaces.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x)

    for (let si = 0; si < spaces.length; si++) {
      const sp = spaces[si]

      for (let ri = 0; ri < rots.length; ri++) {
        const [rw, rd, rh] = rots[ri]

        // Fits in this space?
        if (rw > sp.w + 1e-9 || rd > sp.d + 1e-9 || rh > sp.h + 1e-9) continue

        // Weight check
        if (usedWeight + it.weightKg > maxWeight + 1e-9) continue

        // Stacking check (sp.z is the vertical origin for this placement)
        if (violatesStacking(it, sp.z, placed, itemLookup)) continue

        // Place the item
        placed.push({
          itemTypeId: it.id!,
          px: sp.x,
          py: sp.y,
          pz: sp.z,
          placedLengthM: rw,
          placedWidthM: rd,
          placedHeightM: rh,
          rotation: ri,
        })
        usedWeight += it.weightKg

        // Guillotine split: carve 3 remaining sub-spaces
        const newSpaces: Space[] = []

        // Right of the item (along x)
        const rightW = sp.w - rw
        if (rightW > 1e-9) {
          newSpaces.push({ x: sp.x + rw, y: sp.y, z: sp.z, w: rightW, d: sp.d, h: sp.h })
        }
        // Behind the item (along y)
        const behindD = sp.d - rd
        if (behindD > 1e-9) {
          newSpaces.push({ x: sp.x, y: sp.y + rd, z: sp.z, w: rw, d: behindD, h: sp.h })
        }
        // Above the item (along z)
        const aboveH = sp.h - rh
        if (aboveH > 1e-9) {
          newSpaces.push({ x: sp.x, y: sp.y, z: sp.z + rh, w: rw, d: rd, h: aboveH })
        }

        // Remove the consumed space and add new sub-spaces
        spaces.splice(si, 1, ...newSpaces)

        didPlace = true
        break
      }

      if (didPlace) break
    }

    if (!didPlace) {
      remaining.push(flatItem)
    }
  }

  const usedVolume = placed.reduce(
    (sum, p) => sum + p.placedLengthM * p.placedWidthM * p.placedHeightM,
    0,
  )

  return {
    result: {
      placedItems: placed,
      usedWeightKg: usedWeight,
      utilizationPct: containerVolume > 0 ? (usedVolume / containerVolume) * 100 : 0,
    },
    remainingItems: remaining,
  }
}

// ---------------------------------------------------------------------------
// Main entry: First Fit Decreasing across multiple containers
// ---------------------------------------------------------------------------

export type ProgressCallback = (progress: PackingProgress) => void

export function packItems(
  input: PackingInput,
  onProgress?: ProgressCallback,
): Omit<SimulationResult, 'id' | 'configId' | 'computedAt'> {
  // 1. Build item lookup
  const itemLookup = new Map<number, ItemType>()
  for (const { itemType } of input.items) {
    itemLookup.set(itemType.id!, itemType)
  }

  // 2. Flatten items by quantity, then sort by volume descending (FFD)
  let flatItems: FlatItem[] = []
  let idx = 0
  for (const { itemType, quantity } of input.items) {
    for (let q = 0; q < quantity; q++) {
      flatItems.push({ itemType, index: idx++ })
    }
  }
  const totalCount = flatItems.length

  flatItems.sort((a, b) => {
    const volA = a.itemType.lengthM * a.itemType.widthM * a.itemType.heightM
    const volB = b.itemType.lengthM * b.itemType.widthM * b.itemType.heightM
    return volB - volA
  })

  // 3. Sort container types by cost-per-CBM (cheapest first)
  const sortedContainers = [...input.containerTypes]
    .filter((c) => c.isActive)
    .sort((a, b) => {
      const cbmA = a.lengthM * a.widthM * a.heightM
      const cbmB = b.lengthM * b.widthM * b.heightM
      const cpcA = cbmA > 0 ? a.costPerUnit / cbmA : Infinity
      const cpcB = cbmB > 0 ? b.costPerUnit / cbmB : Infinity
      return cpcA - cpcB
    })

  // 4. Pack into containers
  const packedContainers: PackedContainer[] = []
  let placedSoFar = 0

  while (flatItems.length > 0 && sortedContainers.length > 0) {
    let bestResult: { result: ContainerPackResult; remainingItems: FlatItem[] } | null = null
    let bestContainerIdx = -1

    // Try each container type and pick the one that fits most items
    // while preferring the cheapest cost-per-CBM
    for (let ci = 0; ci < sortedContainers.length; ci++) {
      const trial = packIntoContainer(sortedContainers[ci], flatItems, itemLookup)
      if (trial.result.placedItems.length === 0) continue

      if (
        !bestResult ||
        trial.result.placedItems.length > bestResult.result.placedItems.length
      ) {
        bestResult = trial
        bestContainerIdx = ci
      }
    }

    if (!bestResult || bestContainerIdx === -1) break

    const ct = sortedContainers[bestContainerIdx]

    // Aggregate packedItems summary (itemTypeId → quantity)
    const countMap = new Map<number, number>()
    for (const pi of bestResult.result.placedItems) {
      countMap.set(pi.itemTypeId, (countMap.get(pi.itemTypeId) ?? 0) + 1)
    }

    packedContainers.push({
      containerTypeId: ct.id!,
      placedItems: bestResult.result.placedItems,
      packedItems: Array.from(countMap, ([itemTypeId, quantity]) => ({ itemTypeId, quantity })),
      usedWeightKg: bestResult.result.usedWeightKg,
      utilizationPct: bestResult.result.utilizationPct,
    })

    placedSoFar += bestResult.result.placedItems.length
    flatItems = bestResult.remainingItems

    onProgress?.({
      placedCount: placedSoFar,
      totalCount,
      percent: totalCount > 0 ? Math.round((placedSoFar / totalCount) * 100) : 100,
    })
  }

  // 5. Collect unpacked items
  const unpackedMap = new Map<number, number>()
  for (const fi of flatItems) {
    unpackedMap.set(fi.itemType.id!, (unpackedMap.get(fi.itemType.id!) ?? 0) + 1)
  }
  const unpackedItems = Array.from(unpackedMap, ([itemTypeId, quantity]) => ({
    itemTypeId,
    quantity,
  }))

  // 6. Compute totals
  const containerLookup = new Map<number, ContainerType>()
  for (const ct of input.containerTypes) {
    containerLookup.set(ct.id!, ct)
  }

  const totalCost = packedContainers.reduce((sum, pc) => {
    const ct = containerLookup.get(pc.containerTypeId)
    return sum + (ct?.costPerUnit ?? 0)
  }, 0)

  const avgUtilization =
    packedContainers.length > 0
      ? packedContainers.reduce((sum, pc) => sum + pc.utilizationPct, 0) /
        packedContainers.length
      : 0

  return {
    packedContainers,
    unpackedItems,
    totalCost,
    avgUtilization: Math.round(avgUtilization * 100) / 100,
  }
}
