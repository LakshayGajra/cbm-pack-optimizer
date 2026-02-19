import { useEffect } from 'react'
import { AppRouter } from './router'
import { useContainerStore } from './store/containerStore'
import { useItemStore } from './store/itemStore'
import { useSimulationStore } from './store/simulationStore'

function App() {
  useEffect(() => {
    useContainerStore.getState().loadAll()
    useItemStore.getState().loadAll()
    useSimulationStore.getState().loadAll()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <AppRouter />
    </div>
  )
}

export default App
