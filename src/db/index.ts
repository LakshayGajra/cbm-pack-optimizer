import Dexie, { type Table } from 'dexie'
import type { ContainerType, ItemType, SimulationConfig, SimulationResult } from '../types'

// New containers added in DB v3 (Veero & Tata Ace pickup variants)
const pickupContainersV3: Omit<ContainerType, 'id'>[] = [
  // --- Mahindra Veero ---
  {
    name: 'Veero XL Standard Deck',
    lengthM: 2.765,
    widthM: 1.644,
    heightM: 0.425,
    maxWeightKg: 1550,
    costPerUnit: 4500,
    isActive: true,
  },
  {
    name: 'Veero XXL Standard Deck',
    lengthM: 3.035,
    widthM: 1.644,
    heightM: 0.425,
    maxWeightKg: 1600,
    costPerUnit: 5000,
    isActive: true,
  },
  {
    name: 'Veero XL High Deck',
    lengthM: 2.765,
    widthM: 1.644,
    heightM: 1.20,
    maxWeightKg: 1550,
    costPerUnit: 5000,
    isActive: true,
  },
  {
    name: 'Veero XXL High Deck',
    lengthM: 3.035,
    widthM: 1.644,
    heightM: 1.20,
    maxWeightKg: 1600,
    costPerUnit: 5500,
    isActive: true,
  },
  // --- Tata Ace ---
  {
    name: 'Tata Ace Gold Standard',
    lengthM: 2.20,
    widthM: 1.49,
    heightM: 0.30,
    maxWeightKg: 750,
    costPerUnit: 2500,
    isActive: true,
  },
  {
    name: 'Tata Ace Gold High Deck',
    lengthM: 2.14,
    widthM: 1.43,
    heightM: 1.205,
    maxWeightKg: 750,
    costPerUnit: 3000,
    isActive: true,
  },
  {
    name: 'Tata Ace Gold CNG',
    lengthM: 2.52,
    widthM: 1.49,
    heightM: 0.30,
    maxWeightKg: 900,
    costPerUnit: 2800,
    isActive: true,
  },
  {
    name: 'Tata Ace EV',
    lengthM: 2.163,
    widthM: 1.475,
    heightM: 1.847,
    maxWeightKg: 600,
    costPerUnit: 3500,
    isActive: true,
  },
  {
    name: 'Tata Super Ace',
    lengthM: 2.630,
    widthM: 1.460,
    heightM: 0.30,
    maxWeightKg: 1000,
    costPerUnit: 4000,
    isActive: true,
  },
]

class AppDB extends Dexie {
  containerTypes!: Table<ContainerType>
  itemTypes!: Table<ItemType>
  simulationConfigs!: Table<SimulationConfig>
  simulationResults!: Table<SimulationResult>

  constructor() {
    super('cbmPackOptimizer')
    this.version(2).stores({
      containerTypes: '++id, name, isActive',
      itemTypes: '++id, name',
      simulationConfigs: '++id, name',
      simulationResults: '++id, configId, computedAt',
    })

    // v3: add Veero & Tata Ace pickup container types to existing DBs
    this.version(3).upgrade(tx =>
      tx.table('containerTypes').bulkAdd(pickupContainersV3)
    )

    this.on('populate', () => this.seedData())
  }

  private async seedData() {
    // Seed container types (3 shipping containers)
    const containerTypesData: ContainerType[] = [
      {
        name: '20ft Standard',
        lengthM: 5.90,
        widthM: 2.35,
        heightM: 2.39,
        maxWeightKg: 21800,
        costPerUnit: 45000,
        isActive: true,
      },
      {
        name: '40ft Standard',
        lengthM: 12.03,
        widthM: 2.35,
        heightM: 2.39,
        maxWeightKg: 26480,
        costPerUnit: 68000,
        isActive: true,
      },
      {
        name: '40ft High Cube',
        lengthM: 12.03,
        widthM: 2.35,
        heightM: 2.69,
        maxWeightKg: 26330,
        costPerUnit: 80000,
        isActive: true,
      },
      ...pickupContainersV3,
    ]

    // Seed item types (4 sample items)
    const itemTypesData: ItemType[] = [
      {
        name: 'Smartphone Box',
        lengthM: 0.16,
        widthM: 0.09,
        heightM: 0.04,
        weightKg: 0.25,
        isStackable: true,
        maxStackWeightKg: 20,
        isFragile: false,
        color: '#4A90E2',
      },
      {
        name: 'Laptop Box',
        lengthM: 0.40,
        widthM: 0.30,
        heightM: 0.10,
        weightKg: 2.50,
        isStackable: false,
        maxStackWeightKg: 0,
        isFragile: true,
        color: '#E74C3C',
      },
      {
        name: 'Textile Bale',
        lengthM: 0.80,
        widthM: 0.60,
        heightM: 0.50,
        weightKg: 30.00,
        isStackable: true,
        maxStackWeightKg: 150,
        isFragile: false,
        color: '#2ECC71',
      },
      {
        name: 'Glass Display',
        lengthM: 1.20,
        widthM: 0.80,
        heightM: 0.05,
        weightKg: 8.00,
        isStackable: false,
        maxStackWeightKg: 0,
        isFragile: true,
        color: '#F39C12',
      },
    ]

    await this.containerTypes.bulkAdd(containerTypesData)
    await this.itemTypes.bulkAdd(itemTypesData)
  }
}

export const db = new AppDB()
