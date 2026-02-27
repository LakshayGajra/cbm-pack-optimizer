import { useEffect, useState } from 'react'
import { AppRouter } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useContainerStore } from './store/containerStore'
import { useItemStore } from './store/itemStore'
import { useSimulationStore } from './store/simulationStore'

function AppLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-6 h-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-white/40">Loading data...</p>
      </div>
    </div>
  )
}

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([
      useContainerStore.getState().loadAll(),
      useItemStore.getState().loadAll(),
      useSimulationStore.getState().loadAll(),
    ]).finally(() => setReady(true))
  }, [])

  if (!ready) return <AppLoading />

  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  )
}

export default App
