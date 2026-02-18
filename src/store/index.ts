import { create } from 'zustand'

interface AppStore {
  appName: string
}

export const useAppStore = create<AppStore>(() => ({
  appName: 'CBM Pack Optimizer',
}))
