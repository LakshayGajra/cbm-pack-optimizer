import { create } from 'zustand'
import { db } from '../db'
import type { SimulationConfig, SimulationResult } from '../types'

interface SimulationStore {
  configs: SimulationConfig[]
  results: SimulationResult[]
  isLoading: boolean
  error: string | null

  // Config CRUD
  loadAll: () => Promise<void>
  addConfig: (item: Omit<SimulationConfig, 'id'>) => Promise<void>
  updateConfig: (id: number, patch: Partial<SimulationConfig>) => Promise<void>
  removeConfig: (id: number) => Promise<void>

  // Result CRUD
  addResult: (item: Omit<SimulationResult, 'id'>) => Promise<void>
  updateResult: (id: number, patch: Partial<SimulationResult>) => Promise<void>
  removeResult: (id: number) => Promise<void>
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  configs: [],
  results: [],
  isLoading: false,
  error: null,

  loadAll: async () => {
    try {
      set({ isLoading: true, error: null })
      const configs = await db.simulationConfigs.toArray()
      const results = await db.simulationResults.toArray()
      set({ configs, results })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  addConfig: async (item) => {
    try {
      set({ isLoading: true, error: null })
      await db.simulationConfigs.add(item)
      const configs = await db.simulationConfigs.toArray()
      set({ configs })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  updateConfig: async (id, patch) => {
    try {
      set({ isLoading: true, error: null })
      await db.simulationConfigs.update(id, patch)
      const configs = await db.simulationConfigs.toArray()
      set({ configs })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  removeConfig: async (id) => {
    try {
      set({ isLoading: true, error: null })
      await db.simulationConfigs.delete(id)
      const configs = await db.simulationConfigs.toArray()
      set({ configs })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  addResult: async (item) => {
    try {
      set({ isLoading: true, error: null })
      await db.simulationResults.add(item)
      const results = await db.simulationResults.toArray()
      set({ results })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  updateResult: async (id, patch) => {
    try {
      set({ isLoading: true, error: null })
      await db.simulationResults.update(id, patch)
      const results = await db.simulationResults.toArray()
      set({ results })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  removeResult: async (id) => {
    try {
      set({ isLoading: true, error: null })
      await db.simulationResults.delete(id)
      const results = await db.simulationResults.toArray()
      set({ results })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },
}))
