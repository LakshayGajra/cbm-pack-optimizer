import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Dashboard } from '../pages/Dashboard'
import { NewSimulation } from '../pages/NewSimulation'
import { ResultDetail } from '../pages/ResultDetail'
import { Configs } from '../pages/Configs'
import { LivePacking } from '../pages/LivePacking'
import { Settings } from '../pages/Settings'

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
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
        path: '/live',
        element: <LivePacking />,
      },
      {
        path: '/configs',
        element: <Configs />,
      },
      {
        path: '/settings',
        element: <Settings />,
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
