# CBM Pack Optimizer

An offline-first Progressive Web App for optimizing shipping container packing. Configure container types and item types, run bin-packing simulations, and visualize how items are placed inside containers with interactive 3D views — all running locally in your browser with no backend required.

## Features

### Batch Simulation
Configure items and containers, run the packing engine, and view detailed results with per-container breakdowns, utilization stats, and cost analysis.

### Live Packing
Pick a container, add items one-by-one, and watch each item animate (fall) into the 3D container in real time. Utilization and weight stats update live as you add or remove items.

### 3D Container Visualization
Software-rendered 3D viewer using Canvas 2D with painter's algorithm. Supports drag-to-rotate, scroll/pinch zoom, view presets (Front, Top, Side, Isometric), fullscreen mode, and item type highlighting.

### Container & Item Management
Create and manage custom container types (dimensions, weight limits, cost) and item types (dimensions, weight, color, stacking rules, fragile flags). Ships with default 20ft, 40ft, and 40ft HC containers plus sample items.

### Offline-First PWA
Installable as a PWA with service worker caching. All data stored locally in IndexedDB — works without internet after first load.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Persistence | Dexie (IndexedDB) |
| PWA | vite-plugin-pwa + Workbox |
| 3D Rendering | Custom Canvas 2D (no Three.js) |
| Testing | Vitest |

## Getting Started

### Prerequisites
- Node.js 20.19+ or 22.12+

### Install & Run

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:5173
```

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── AppShell.tsx              # Layout shell with sidebar + mobile nav
│   ├── ContainerViewer3D.tsx     # 3D viewer for simulation results
│   ├── LivePackingViewer.tsx     # Animated 3D viewer for live packing
│   └── icons.tsx                 # Inline SVG icon components
├── db/
│   └── index.ts                  # Dexie database with seed data
├── lib/
│   ├── 3d-helpers.ts             # Shared 3D math (rotation, projection, etc.)
│   └── packing/
│       ├── engine.ts             # FFD bin-packing with guillotine splitting
│       ├── engine.test.ts        # Packing engine tests
│       ├── packing.worker.ts     # Web Worker wrapper
│       └── runPacking.ts         # Promise-based worker API
├── pages/
│   ├── Dashboard.tsx             # Home page with overview stats
│   ├── NewSimulation.tsx         # Simulation configuration
│   ├── ResultDetail.tsx          # Simulation results with 3D viewer
│   ├── LivePacking.tsx           # Interactive live packing page
│   ├── Configs.tsx               # Container & item type management
│   └── Settings.tsx              # App settings
├── store/
│   ├── containerStore.ts         # Container types CRUD
│   ├── itemStore.ts              # Item types CRUD
│   └── simulationStore.ts        # Simulations CRUD
├── router/
│   └── index.tsx                 # React Router v6 routes
└── types/
    └── index.ts                  # TypeScript type definitions
```

## Packing Algorithm

The engine uses **First Fit Decreasing (FFD)** with guillotine space splitting:

1. Items sorted by volume (largest first)
2. For each item, try all 6 axis-aligned rotations
3. Place into the first available space that fits
4. Split remaining space into 3 sub-spaces (right, behind, above)
5. Respects weight limits, stacking constraints, and fragile item rules
6. Tries multiple container types and picks the best fit per round

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | ESLint across the project |
| `npx vitest run` | Run all tests |

## Routes

| Path | Page | Description |
|---|---|---|
| `/` | Dashboard | Overview with recent simulations and stats |
| `/simulate` | New Simulation | Configure and run batch packing simulations |
| `/live` | Live Packing | Interactive real-time packing with animations |
| `/results/:id` | Result Detail | View simulation results with 3D visualization |
| `/configs` | Configs | Manage container and item types |
| `/settings` | Settings | App preferences |

## License

MIT
