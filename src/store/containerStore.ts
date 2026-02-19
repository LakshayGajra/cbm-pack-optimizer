import { create } from 'zustand'
import { db } from '../db'
import type { ContainerType } from '../types'

interface ContainerStore {
  items: ContainerType[]
  isLoading: boolean
  error: string | null
  loadAll: () => Promise<void>
  add: (item: Omit<ContainerType, 'id'>) => Promise<void>
  update: (id: number, patch: Partial<ContainerType>) => Promise<void>
  remove: (id: number) => Promise<void>
}

export const useContainerStore = create<ContainerStore>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  loadAll: async () => {
    try {
      set({ isLoading: true, error: null })
      const items = await db.containerTypes.toArray()
      set({ items })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  add: async (item) => {
    try {
      set({ isLoading: true, error: null })
      await db.containerTypes.add(item)
      const items = await db.containerTypes.toArray()
      set({ items })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  update: async (id, patch) => {
    try {
      set({ isLoading: true, error: null })
      await db.containerTypes.update(id, patch)
      const items = await db.containerTypes.toArray()
      set({ items })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  remove: async (id) => {
    try {
      set({ isLoading: true, error: null })
      await db.containerTypes.delete(id)
      const items = await db.containerTypes.toArray()
      set({ items })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },
}))
