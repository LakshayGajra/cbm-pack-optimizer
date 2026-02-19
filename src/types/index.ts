export interface ContainerType {
  id?: number
  name: string
  lengthM: number
  widthM: number
  heightM: number
  maxWeightKg: number
  costPerUnit: number        // INR
  isActive: boolean
}

export interface ItemType {
  id?: number
  name: string
  lengthM: number
  widthM: number
  heightM: number
  weightKg: number
  isStackable: boolean
  maxStackWeightKg: number
  isFragile: boolean
  color: string              // hex e.g. "#3498DB"
}

export interface SimulationConfig {
  id?: number
  name: string
  containerTypes: Array<{ containerTypeId: number; quantity: number }>
  items: Array<{ itemTypeId: number; quantity: number }>
}

export interface PlacedItem {
  itemTypeId: number
  px: number                 // placement origin x (m)
  py: number                 // placement origin y (m)
  pz: number                 // placement origin z (m)
  placedLengthM: number      // dimension along x after rotation
  placedWidthM: number       // dimension along y after rotation
  placedHeightM: number      // dimension along z after rotation
  rotation: number           // rotation index 0–5
}

export interface PackedContainer {
  containerTypeId: number
  placedItems: PlacedItem[]
  packedItems: Array<{ itemTypeId: number; quantity: number }>
  usedWeightKg: number
  utilizationPct: number     // volume utilization 0–100
}

export interface SimulationResult {
  id?: number
  configId: number
  packedContainers: PackedContainer[]
  unpackedItems: Array<{ itemTypeId: number; quantity: number }>
  totalCost: number          // INR sum
  avgUtilization: number     // 0–100
  computedAt: Date
}

/** Input to the packing engine (plain data, no DB references needed) */
export interface PackingInput {
  containerTypes: ContainerType[]
  items: Array<{ itemType: ItemType; quantity: number }>
}

/** Progress callback payload */
export interface PackingProgress {
  placedCount: number
  totalCount: number
  percent: number
}

/** Messages sent from packing worker to main thread */
export type PackingWorkerResult =
  | { type: 'progress'; data: PackingProgress }
  | { type: 'done'; data: Omit<SimulationResult, 'id' | 'configId' | 'computedAt'> }
  | { type: 'error'; message: string }
