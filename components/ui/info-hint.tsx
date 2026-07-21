'use client'

import { Info } from 'lucide-react'
import { useState } from 'react'

/**
 * Inline info affordance for section headers and controls that aren't a full
 * page (those use PageHeader's `info`). An info icon toggles a short muted
 * explanation. Keep the text one or two sentences, in member language.
 */
export function InfoHint({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label={label ?? 'More info'}
        aria-expanded={open}
      >
        <Info size={15} />
      </button>
      {open && (
        <span className="absolute z-20 mt-6 max-w-xs rounded-lg border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {text}
        </span>
      )}
    </span>
  )
}
