import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Dashboard } from '../pages/Dashboard'
import { NewSimulation } from '../pages/NewSimulation'
import { ResultDetail } from '../pages/ResultDetail'
import { SavedConfigs } from '../pages/SavedConfigs'
import { Settings } from '../pages/Settings'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Dashboard />,
  },
  {
    path: '/simulate',
    element: <NewSimulation />,
  },
  {
    path: '/results/:id',
    element: <ResultDetail />,
  },
  {
    path: '/configs',
    element: <SavedConfigs />,
  },
  {
    path: '/settings',
    element: <Settings />,
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
