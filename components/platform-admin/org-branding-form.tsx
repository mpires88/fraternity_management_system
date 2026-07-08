'use client'

import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { updateParentOrg } from '@/actions/platform-admin.action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ParentOrgRow } from '@/dal/platform-admin'

type Props = {
  org: ParentOrgRow
}

export function OrgBrandingForm({ org }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(org.name)
  const [abbreviation, setAbbreviation] = useState(org.abbreviation ?? '')
  const [primaryColor, setPrimaryColor] = useState(org.primary_color ?? '#000000')
  const [secondaryColor, setSecondaryColor] = useState(org.secondary_color ?? '#FFFFFF')
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? '')
  const [website, setWebsite] = useState(org.website ?? '')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    startTransition(async () => {
      await updateParentOrg({
        id: org.id,
        name: name.trim(),
        abbreviation: abbreviation.trim() || null,
        primary_color: primaryColor || null,
        secondary_color: secondaryColor || null,
        logo_url: logoUrl.trim() || null,
        website: website.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/platform-admin/national-orgs">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft size={14} />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{org.name}</h2>
          <p className="text-sm text-muted-foreground">
            {org.org_type ?? 'organization'}
            {org.founded_year && ` · Founded ${org.founded_year}`}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abbreviation">Abbreviation</Label>
            <Input
              id="abbreviation"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              placeholder="ΣΝ"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="primary-color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded border border-border cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 font-mono text-sm"
                placeholder="#000000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary-color">Secondary Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="secondary-color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded border border-border cursor-pointer"
              />
              <Input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 font-mono text-sm"
                placeholder="#FFFFFF"
              />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-3">Preview</p>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <div
                className="w-12 h-12 rounded-lg border border-border"
                style={{ backgroundColor: primaryColor }}
              />
              <div
                className="w-12 h-12 rounded-lg border border-border"
                style={{ backgroundColor: secondaryColor }}
              />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: primaryColor }}>
                {name}
              </p>
              <p className="text-xs text-muted-foreground">{abbreviation}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logo-url">Logo URL</Label>
          <Input
            id="logo-url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
          />
          {logoUrl && (
            <div className="mt-2 p-3 border border-border rounded-lg bg-muted/30 inline-block">
              {/* biome-ignore lint/performance/noImgElement: external URL, domain unknown at build time */}
              <img src={logoUrl} alt="Logo preview" className="max-h-16 max-w-32 object-contain" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.org"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            <Save size={14} className="mr-1.5" />
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  )
}
