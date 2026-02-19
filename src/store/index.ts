import { create } from 'zustand'

interface AppStore {
  appName: string
}

export const useAppStore = create<AppStore>(() => ({
  appName: 'CBM Pack Optimizer',
}))

export { useContainerStore } from './containerStore'
export { useItemStore } from './itemStore'
export { useSimulationStore } from './simulationStore'
