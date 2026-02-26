import { NavLink, Outlet } from 'react-router-dom'
import { HomeIcon, AdjustmentsIcon, PlayIcon, CogIcon, CubeIcon, BoltIcon } from './icons'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', Icon: HomeIcon, end: true },
  { path: '/simulate', label: 'Simulate', Icon: PlayIcon, end: false },
  { path: '/live', label: 'Live Pack', Icon: BoltIcon, end: false },
  { path: '/configs', label: 'Configs', Icon: AdjustmentsIcon, end: false },
  { path: '/settings', label: 'Settings', Icon: CogIcon, end: false },
] as const

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
        <CubeIcon className="w-4 h-4 text-accent" />
      </div>
      <span className="font-semibold text-white text-sm tracking-wide">
        CBM <span className="text-accent">Optimizer</span>
      </span>
    </div>
  )
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Desktop: left sidebar ───────────────────────────────── */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-r md:border-border md:bg-surface/50 z-40">
        {/* Sidebar header */}
        <div className="flex h-14 items-center px-4 border-b border-border">
          <Logo />
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ path, label, Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] text-slate-600 text-center">
            Offline-ready PWA
          </p>
        </div>
      </aside>

      {/* ── Mobile: top bar ─────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 h-12 flex items-center">
          <Logo />
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────── */}
      <main className="pb-20 md:pb-0 md:pl-56">
        <Outlet />
      </main>

      {/* ── Mobile: bottom nav ──────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-border">
        <div className="flex safe-area-inset-bottom">
          {NAV_ITEMS.map(({ path, label, Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 pt-2 pb-3 text-[10px] font-medium tracking-wide uppercase transition-colors ${
                  isActive ? 'text-accent' : 'text-white/40'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
