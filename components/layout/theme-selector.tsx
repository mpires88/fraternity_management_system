'use client'

import { Check, Palette } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  getAllPalettes,
  getOrgPalette,
  setActivePalette,
} from '@/components/providers/brand-color-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Palette as PaletteType } from '@/lib/utils/color'

export function ThemeSelector({
  orgPrimaryColor,
  orgSecondaryColor,
}: {
  orgPrimaryColor: string | null
  orgSecondaryColor: string | null
}) {
  const [activeId, setActiveId] = useState('org')

  const orgPalette = getOrgPalette(orgPrimaryColor, orgSecondaryColor)
  const palettes = getAllPalettes(orgPalette)

  useEffect(() => {
    const stored = localStorage.getItem('brand-palette')
    if (stored) setActiveId(stored)

    function onUpdate() {
      setActiveId(localStorage.getItem('brand-palette') ?? 'org')
    }
    window.addEventListener('brand-theme-change', onUpdate)
    return () => window.removeEventListener('brand-theme-change', onUpdate)
  }, [])

  function pick(id: string) {
    setActiveId(id)
    setActivePalette(id)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <Palette size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuLabel>Color Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {palettes.map((p) => (
          <PaletteOption key={p.id} palette={p} active={activeId === p.id} onSelect={pick} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PaletteOption({
  palette,
  active,
  onSelect,
}: {
  palette: PaletteType
  active: boolean
  onSelect: (id: string) => void
}) {
  return (
    <DropdownMenuItem onClick={() => onSelect(palette.id)}>
      <div className="flex items-center gap-0.5 shrink-0">
        {palette.colors.map((color) => (
          <span
            key={color}
            className="w-3.5 h-3.5 rounded-full border border-border"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <span className="flex-1 ml-1.5">{palette.name}</span>
      {active && <Check size={14} className="text-brand shrink-0" />}
    </DropdownMenuItem>
  )
}
