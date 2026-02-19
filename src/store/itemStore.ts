import { create } from 'zustand'
import { db } from '../db'
import type { ItemType } from '../types'

interface ItemStore {
  items: ItemType[]
  isLoading: boolean
  error: string | null
  loadAll: () => Promise<void>
  add: (item: Omit<ItemType, 'id'>) => Promise<void>
  update: (id: number, patch: Partial<ItemType>) => Promise<void>
  remove: (id: number) => Promise<void>
}

export const useItemStore = create<ItemStore>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  loadAll: async () => {
    try {
      set({ isLoading: true, error: null })
      const items = await db.itemTypes.toArray()
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
      await db.itemTypes.add(item)
      const items = await db.itemTypes.toArray()
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
      await db.itemTypes.update(id, patch)
      const items = await db.itemTypes.toArray()
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
      await db.itemTypes.delete(id)
      const items = await db.itemTypes.toArray()
      set({ items })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },
}))
