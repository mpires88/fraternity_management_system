'use client'

import { useEffect, useState } from 'react'
import { useOrg } from '@/lib/context/org-context'
import { hexToPaletteVars, type Palette, STATIC_PALETTES } from '@/lib/utils/color'

const STORAGE_KEY = 'brand-palette'
const STYLE_ID = 'brand-color-override'

export function getOrgPalette(
  primaryColor: string | null | undefined,
  secondaryColor: string | null | undefined
): Palette | null {
  if (!primaryColor) return null
  const colors = [primaryColor]
  if (secondaryColor) colors.push(secondaryColor)
  return { id: 'org', name: 'Organization', colors }
}

export function getAllPalettes(orgPalette: Palette | null): Palette[] {
  if (!orgPalette) return STATIC_PALETTES
  return [orgPalette, ...STATIC_PALETTES]
}

function getStoredPaletteId(): string {
  if (typeof window === 'undefined') return 'org'
  return localStorage.getItem(STORAGE_KEY) ?? 'org'
}

export function BrandColorProvider({ children }: { children: React.ReactNode }) {
  const { parentOrg } = useOrg()
  const [paletteId, setPaletteId] = useState('org')

  useEffect(() => {
    setPaletteId(getStoredPaletteId())

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setPaletteId(getStoredPaletteId())
    }
    function onCustom() {
      setPaletteId(getStoredPaletteId())
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('brand-theme-change', onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('brand-theme-change', onCustom)
    }
  }, [])

  useEffect(() => {
    const orgPalette = getOrgPalette(parentOrg?.primary_color, parentOrg?.secondary_color)
    const allPalettes = getAllPalettes(orgPalette)
    const palette = allPalettes.find((p) => p.id === paletteId) ?? allPalettes[0]

    let el = document.getElementById(STYLE_ID)

    if (!palette) {
      el?.remove()
      return
    }

    const v = hexToPaletteVars(palette.colors)
    const css = [
      `:root{`,
      `--brand:${v.brand};`,
      `--brand-hover:${v.brandHover};`,
      `--brand-foreground:${v.brandForeground};`,
      `--accent:${v.accent};`,
      `--accent-foreground:${v.accentForeground};`,
      `--sidebar:${v.sidebar};`,
      `--sidebar-accent:${v.sidebarAccent};`,
      `}`,
      `.dark{`,
      `--brand:${v.brandDark};`,
      `--brand-hover:${v.brandHoverDark};`,
      `--brand-foreground:${v.brandForeground};`,
      `--accent:${v.accentDark};`,
      `--accent-foreground:${v.accentForegroundDark};`,
      `--sidebar:${v.sidebarDark};`,
      `--sidebar-accent:${v.sidebarAccentDark};`,
      `}`,
    ].join('')

    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ID
      document.head.appendChild(el)
    }
    el.textContent = css

    return () => {
      document.getElementById(STYLE_ID)?.remove()
    }
  }, [paletteId, parentOrg?.primary_color, parentOrg?.secondary_color])

  return <>{children}</>
}

export function setActivePalette(id: string) {
  localStorage.setItem(STORAGE_KEY, id)
  window.dispatchEvent(new Event('brand-theme-change'))
}
