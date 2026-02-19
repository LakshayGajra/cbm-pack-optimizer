import { NavLink, Outlet } from 'react-router-dom'
import { HomeIcon, AdjustmentsIcon, PlayIcon } from './icons'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', Icon: HomeIcon, end: true },
  { path: '/configs', label: 'Config', Icon: AdjustmentsIcon, end: false },
  { path: '/simulate', label: 'Simulate', Icon: PlayIcon, end: false },
] as const

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      </div>
      <span className="font-semibold text-white text-sm tracking-wide">
        CBM <span className="text-accent">Optimizer</span>
      </span>
    </div>
  )
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map(({ path, label, Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/15 text-accent'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-20 sm:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-border flex safe-area-inset-bottom">
        {NAV_ITEMS.map(({ path, label, Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 pt-2 pb-3 text-[10px] font-medium tracking-wide uppercase transition-colors ${
                isActive ? 'text-accent' : 'text-white/40'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
