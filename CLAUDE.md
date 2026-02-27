# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CBM Pack Optimizer is an offline-first PWA for optimizing shipping container packing. Users configure container types and item types, run bin-packing simulations, and view 3D visualizations of how items are placed inside containers. All data is stored locally in IndexedDB via Dexie — there is no backend.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — TypeScript check + Vite production build
- `npm run lint` — ESLint across the project
- `npx vitest run` — Run all tests
- `npx vitest run src/lib/packing/engine.test.ts` — Run a single test file

## Tech Stack

- **React 19** + **TypeScript** + **Vite 7** (with `@vitejs/plugin-react`)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — styles imported in `src/index.css` with `@import "tailwindcss"` and custom theme tokens defined in `@theme` block
- **Zustand** for state management (stores in `src/store/`)
- **Dexie** (IndexedDB wrapper) for persistence (`src/db/index.ts`)
- **vite-plugin-pwa** with Workbox generateSW strategy for service worker
- **No component library** — all UI is hand-built with Tailwind utility classes

## Architecture

### Routing & Layout
- `src/router/index.tsx` — React Router v6 `createBrowserRouter` with all routes
- `src/components/AppShell.tsx` — Shell layout with desktop sidebar (hidden on mobile) + mobile bottom nav + top bar. Pages render inside `<Outlet />`
- Routes: `/` (Dashboard), `/simulate` (NewSimulation), `/results/:id` (ResultDetail), `/configs` (Configs), `/settings` (Settings)

### Data Layer
- **Types** (`src/types/index.ts`): `ContainerType`, `ItemType`, `SimulationConfig`, `SimulationResult`, `PackedContainer`, `PlacedItem`
- **DB** (`src/db/index.ts`): Dexie database `cbmPackOptimizer` with 4 tables; seeds default container types (20ft, 40ft, 40ft HC) and sample items on first run
- **Stores** (`src/store/`): Three Zustand stores (`containerStore`, `itemStore`, `simulationStore`) each wrapping Dexie CRUD with `loadAll`, `add`, `update`, `remove` patterns

### Packing Engine
- `src/lib/packing/engine.ts` — Pure function `packItems()` implementing First Fit Decreasing with guillotine space splitting. Handles 6 axis-aligned rotations, stacking constraints, fragile item rules, and weight limits
- `src/lib/packing/packing.worker.ts` — Web Worker wrapper for the engine
- `src/lib/packing/runPacking.ts` — Promise-based API that spawns the worker and relays progress callbacks
- Tests in `src/lib/packing/engine.test.ts` (Vitest)

### 3D Visualization
- `src/components/ContainerViewer3D.tsx` — Pure Canvas 2D renderer (no Three.js). Implements software 3D with painter's algorithm: box corners → rotateY/rotateX transforms → isometric projection. Supports mouse drag rotation, scroll zoom, touch drag, and item type highlight on hover/click. Uses `ResizeObserver` for responsive canvas sizing

### Coordinate Mapping (3D Viewer)
The packing engine uses (px=length/x, py=width/y, pz=height/z). The 3D viewer remaps: `3D_x = px`, `3D_y = pz` (height→up), `3D_z = py` (width→depth)

## Styling Conventions

- Dark theme with custom Tailwind tokens: `background` (#080C14), `surface` (#0F1420), `border` (#1E293B), `accent` (#3498DB)
- Mobile-first responsive: `md:` breakpoint for desktop sidebar, `sm:` for layout adjustments
- Icons are inline SVG components in `src/components/icons.tsx`
- Bottom nav has `pb-20` spacer on `<main>` for mobile
