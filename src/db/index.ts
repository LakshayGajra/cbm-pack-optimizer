import Dexie, { type Table } from 'dexie'

export interface Simulation {
  id?: number
  name: string
  createdAt: Date
}

class AppDB extends Dexie {
  simulations!: Table<Simulation>

  constructor() {
    super('cbmPackOptimizer')
    this.version(1).stores({
      simulations: '++id, createdAt',
    })
  }
}

export const db = new AppDB()
