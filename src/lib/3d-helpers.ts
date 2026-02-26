// Shared 3D math helpers used by ContainerViewer3D and LivePackingViewer

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Face {
  vertices: Vec3[]
  color: string
  alpha: number
  depth: number
}

export const VIEW_PRESETS = {
  front: { rotX: 0, rotY: -Math.PI / 2 },
  top: { rotX: -Math.PI / 2, rotY: 0 },
  side: { rotX: 0, rotY: 0 },
  iso: { rotX: -0.45, rotY: 0.65 },
} as const

export function toItemCode(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function shadeFace(
  hex: string,
  face: 'top' | 'right' | 'left',
  alpha: number,
): string {
  const { r, g, b } = hexToRgb(hex)
  const factor = face === 'top' ? 1.0 : face === 'right' ? 0.75 : 0.55
  return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${alpha})`
}

export function rotateY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }
}

export function rotateX(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c }
}

export function projectIso(v: Vec3, zoom: number, cx: number, cy: number): { x: number; y: number } {
  return {
    x: cx + v.x * zoom,
    y: cy - v.y * zoom,
  }
}

export function faceCentroid(vertices: Vec3[]): Vec3 {
  const n = vertices.length
  let x = 0, y = 0, z = 0
  for (const v of vertices) { x += v.x; y += v.y; z += v.z }
  return { x: x / n, y: y / n, z: z / n }
}

export function boxCorners(ox: number, oy: number, oz: number, sx: number, sy: number, sz: number): Vec3[] {
  return [
    { x: ox, y: oy, z: oz },
    { x: ox + sx, y: oy, z: oz },
    { x: ox + sx, y: oy + sy, z: oz },
    { x: ox, y: oy + sy, z: oz },
    { x: ox, y: oy, z: oz + sz },
    { x: ox + sx, y: oy, z: oz + sz },
    { x: ox + sx, y: oy + sy, z: oz + sz },
    { x: ox, y: oy + sy, z: oz + sz },
  ]
}

export function boxFaces(c: Vec3[]): Vec3[][] {
  return [
    [c[0], c[1], c[2], c[3]],
    [c[5], c[4], c[7], c[6]],
    [c[4], c[0], c[3], c[7]],
    [c[1], c[5], c[6], c[2]],
    [c[3], c[2], c[6], c[7]],
    [c[0], c[4], c[5], c[1]],
  ]
}

export function boxEdges(c: Vec3[]): [Vec3, Vec3][] {
  return [
    [c[0], c[1]], [c[1], c[2]], [c[2], c[3]], [c[3], c[0]],
    [c[4], c[5]], [c[5], c[6]], [c[6], c[7]], [c[7], c[4]],
    [c[0], c[4]], [c[1], c[5]], [c[2], c[6]], [c[3], c[7]],
  ]
}

export function faceShadeType(vertices: Vec3[]): 'top' | 'right' | 'left' {
  const a = vertices[0], b = vertices[1], c = vertices[2]
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
  const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }
  const ny = u.z * v.x - u.x * v.z
  if (ny > 0.3) return 'top'
  if (ny < -0.3) return 'left'
  return 'right'
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
