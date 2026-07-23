import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (claimsData?.claims) redirect('/home')

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/60">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            Chapter Management Platform
          </span>
          <Link
            href="/login"
            className="text-sm font-medium text-brand hover:text-brand-hover transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight">
          Run your chapter
          <br />
          <span className="text-brand">without the chaos</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Requirements, recruitment, budgets, and member management in one place. Built for
          organizations where leadership changes every year.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-sm font-medium transition-colors"
          >
            Get started
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={<ClipboardList size={20} />}
            title="Requirements tracking"
            description="Define chapter requirements by term. Track completions, overrides, and exemptions with a clear audit trail."
          />
          <FeatureCard
            icon={<UserPlus size={20} />}
            title="Recruitment management"
            description="Manage prospects, events, and voting rounds. Move candidates through your pipeline from interest to bid."
          />
          <FeatureCard
            icon={<DollarSign size={20} />}
            title="Budgets & reimbursements"
            description="Set budgets by category, submit reimbursements with receipts, and track spending against limits."
          />
          <FeatureCard
            icon={<Users size={20} />}
            title="Member management"
            description="One roster for actives, new members, alumni, and advisors. Role-based access keeps everyone in their lane."
          />
          <FeatureCard
            icon={<Shield size={20} />}
            title="Role-based permissions"
            description="Assign roles by group — president, treasurer, chair. Each role sees exactly what they need, nothing more."
          />
          <FeatureCard
            icon={<CheckCircle2 size={20} />}
            title="Built for turnover"
            description="New officers get up to speed in minutes, not weeks. Every page explains itself so no training manual is needed."
          />
        </div>
      </section>

      {/* Social proof / value prop */}
      <section className="border-t border-border/60">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Stop managing your chapter in spreadsheets
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Most chapters juggle Google Sheets, GroupMe threads, and Venmo screenshots to keep
            things running. When leadership transitions, institutional knowledge walks out the door.
            This platform keeps it all in one place so the next exec board doesn&apos;t start from
            scratch.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 mt-8 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
          >
            Sign in to your chapter
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Chapter Management Platform</p>
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/[0.06] p-5">
      <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center text-brand mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}
