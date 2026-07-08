function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  ]
}

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = linearize(r)
  const lg = linearize(g)
  const lb = linearize(b)

  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}

export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const [r, g, b] = hexToRgb(hex)
  const [L, a, bVal] = rgbToOklab(r, g, b)
  const c = Math.sqrt(a * a + bVal * bVal)
  let h = (Math.atan2(bVal, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h }
}

export function oklchToCss(l: number, c: number, h: number): string {
  return `oklch(${round(l)} ${round(c)} ${round(h)})`
}

function round(n: number): string {
  return Number(n.toFixed(4)).toString()
}

export type PaletteVars = {
  brand: string
  brandHover: string
  brandForeground: string
  brandDark: string
  brandHoverDark: string
  accent: string
  accentForeground: string
  accentDark: string
  accentForegroundDark: string
  sidebar: string
  sidebarDark: string
  sidebarAccent: string
  sidebarAccentDark: string
}

function foregroundFor(l: number): string {
  return l > 0.6 ? 'oklch(0.145 0 0)' : 'oklch(1 0 0)'
}

export function hexToPaletteVars(colors: string[]): PaletteVars {
  const primary = hexToOklch(colors[0])
  const secondary = colors[1] ? hexToOklch(colors[1]) : null
  const tertiary = colors[2] ? hexToOklch(colors[2]) : null

  const accentSource = secondary ?? { l: 0.97, c: 0, h: 0 }
  const sidebarSource = tertiary ?? secondary ?? primary

  return {
    brand: oklchToCss(primary.l, primary.c, primary.h),
    brandHover: oklchToCss(Math.max(0, primary.l - 0.07), primary.c, primary.h),
    brandForeground: foregroundFor(primary.l),
    brandDark: oklchToCss(Math.min(1, primary.l + 0.15), primary.c, primary.h),
    brandHoverDark: oklchToCss(Math.min(1, primary.l + 0.1), primary.c, primary.h),
    accent: oklchToCss(0.96, accentSource.c * 0.15, accentSource.h),
    accentForeground: oklchToCss(0.25, accentSource.c * 0.3, accentSource.h),
    accentDark: oklchToCss(0.25, accentSource.c * 0.15, accentSource.h),
    accentForegroundDark: oklchToCss(0.9, accentSource.c * 0.1, accentSource.h),
    sidebar: oklchToCss(0.98, sidebarSource.c * 0.03, sidebarSource.h),
    sidebarDark: oklchToCss(0.2, sidebarSource.c * 0.03, sidebarSource.h),
    sidebarAccent: oklchToCss(0.95, sidebarSource.c * 0.08, sidebarSource.h),
    sidebarAccentDark: oklchToCss(0.28, sidebarSource.c * 0.06, sidebarSource.h),
  }
}

export function hexToBrandVars(hex: string): {
  brand: string
  brandHover: string
  brandForeground: string
  brandDark: string
  brandHoverDark: string
} {
  const { l, c, h } = hexToOklch(hex)
  return {
    brand: oklchToCss(l, c, h),
    brandHover: oklchToCss(Math.max(0, l - 0.07), c, h),
    brandForeground: foregroundFor(l),
    brandDark: oklchToCss(Math.min(1, l + 0.15), c, h),
    brandHoverDark: oklchToCss(Math.min(1, l + 0.1), c, h),
  }
}

export type Palette = {
  id: string
  name: string
  colors: string[]
}

export const STATIC_PALETTES: Palette[] = [
  {
    id: 'default',
    name: 'Default Purple',
    colors: ['#7C3AED', '#8B5CF6', '#6D28D9'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0369A1', '#06B6D4', '#164E63'],
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: ['#15803D', '#86EFAC', '#14532D'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#C2410C', '#F59E0B', '#7C2D12'],
  },
]
