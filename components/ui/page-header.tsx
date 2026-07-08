'use client'

import { Info } from 'lucide-react'
import { useState } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  info?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, info, children }: PageHeaderProps) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {info && (
              <button
                type="button"
                onClick={() => setShowInfo((v) => !v)}
                className="text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-0.5"
                aria-label="Page info"
              >
                <Info size={16} />
              </button>
            )}
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
      </div>
      {info && showInfo && (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <Info size={14} className="mt-0.5 shrink-0 text-muted-foreground/70" />
          <p>{info}</p>
        </div>
      )}
    </div>
  )
}
