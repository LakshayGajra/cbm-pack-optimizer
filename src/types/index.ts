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

export interface SimulationResult {
  id?: number
  configId: number
  packedContainers: Array<{
    containerTypeId: number
    packedItems: Array<{ itemTypeId: number; quantity: number }>
    utilizationPct: number
  }>
  unpackedItems: Array<{ itemTypeId: number; quantity: number }>
  totalCost: number          // INR sum
  avgUtilization: number     // 0–100
  computedAt: Date
}
