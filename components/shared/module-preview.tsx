import { Hammer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'

/**
 * Placeholder for a module whose schema exists but whose feature code hasn't
 * landed yet — lets the navigation show the real layout without dead links.
 */
export function ModulePreview({
  title,
  description,
  phase,
  items,
}: {
  title: string
  description: string
  phase: string
  items: { label: string; detail: string }[]
}) {
  return (
    <div className="p-8">
      <PageHeader title={title} description={description} />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Hammer size={15} className="text-brand" />
            <p className="text-sm font-medium text-foreground">
              Coming in {phase} — the tables and permissions are already live.
            </p>
          </div>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.label} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand/60 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
