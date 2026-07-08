import { describe, expect, it } from 'vitest'
import { hexToBrandVars, hexToOklch, hexToPaletteVars, oklchToCss, STATIC_PALETTES } from './color'

describe('hexToOklch', () => {
  it('converts black', () => {
    const { l, c } = hexToOklch('#000000')
    expect(l).toBeCloseTo(0, 1)
    expect(c).toBeCloseTo(0, 1)
  })

  it('converts white', () => {
    const { l, c } = hexToOklch('#FFFFFF')
    expect(l).toBeCloseTo(1, 1)
    expect(c).toBeCloseTo(0, 1)
  })

  it('converts pure red', () => {
    const { l, c, h } = hexToOklch('#FF0000')
    expect(l).toBeGreaterThan(0.5)
    expect(c).toBeGreaterThan(0.2)
    expect(h).toBeGreaterThan(20)
    expect(h).toBeLessThan(30)
  })

  it('converts Sigma Nu gold', () => {
    const { l, c, h } = hexToOklch('#C4A747')
    expect(l).toBeGreaterThan(0.6)
    expect(c).toBeGreaterThan(0.1)
    expect(h).toBeGreaterThan(80)
    expect(h).toBeLessThan(110)
  })
})

describe('oklchToCss', () => {
  it('formats oklch string', () => {
    expect(oklchToCss(0.5, 0.15, 270)).toBe('oklch(0.5 0.15 270)')
  })

  it('trims trailing zeros', () => {
    expect(oklchToCss(0.45, 0.15, 270)).toBe('oklch(0.45 0.15 270)')
  })
})

describe('hexToBrandVars', () => {
  it('returns darker hover for light colors', () => {
    const vars = hexToBrandVars('#C4A747')
    expect(vars.brand).toContain('oklch(')
    expect(vars.brandHover).toContain('oklch(')
    expect(vars.brandForeground).toBe('oklch(0.145 0 0)')
  })

  it('returns white foreground for dark colors', () => {
    const vars = hexToBrandVars('#000000')
    expect(vars.brandForeground).toBe('oklch(1 0 0)')
  })

  it('provides dark mode variants', () => {
    const vars = hexToBrandVars('#003087')
    expect(vars.brandDark).toContain('oklch(')
    expect(vars.brandHoverDark).toContain('oklch(')
  })
})

describe('hexToPaletteVars', () => {
  it('generates all variables from a single color', () => {
    const vars = hexToPaletteVars(['#7C3AED'])
    expect(vars.brand).toContain('oklch(')
    expect(vars.accent).toContain('oklch(')
    expect(vars.sidebar).toContain('oklch(')
  })

  it('uses secondary color for accent when provided', () => {
    const single = hexToPaletteVars(['#0369A1'])
    const dual = hexToPaletteVars(['#0369A1', '#06B6D4'])
    expect(single.accent).not.toBe(dual.accent)
  })

  it('uses tertiary color for sidebar tint when provided', () => {
    const dual = hexToPaletteVars(['#0369A1', '#06B6D4'])
    const tri = hexToPaletteVars(['#0369A1', '#06B6D4', '#164E63'])
    expect(dual.sidebar).not.toBe(tri.sidebar)
  })

  it('generates distinct light and dark variants', () => {
    const vars = hexToPaletteVars(['#15803D', '#86EFAC', '#14532D'])
    expect(vars.accent).not.toBe(vars.accentDark)
    expect(vars.sidebar).not.toBe(vars.sidebarDark)
  })
})

describe('STATIC_PALETTES', () => {
  it('has 4 static palettes', () => {
    expect(STATIC_PALETTES).toHaveLength(4)
  })

  it('each palette has 2-3 colors', () => {
    for (const p of STATIC_PALETTES) {
      expect(p.colors.length).toBeGreaterThanOrEqual(2)
      expect(p.colors.length).toBeLessThanOrEqual(3)
    }
  })

  it('each palette has a unique id', () => {
    const ids = STATIC_PALETTES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
