/**
 * Ensures the budget feature flag is enabled for the chapter group.
 * Run: npx tsx --env-file=.env.local e2e/enable-budget-feature.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

async function main() {
  const { data: parentOrg } = await supabase
    .from('parent_organizations')
    .select('id')
    .eq('slug', 'sigma-nu')
    .single()
  if (!parentOrg) throw new Error('sigma-nu not found')

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'epsilon-theta')
    .eq('parent_organization_id', parentOrg.id)
    .single()
  if (!org) throw new Error('epsilon-theta not found')

  const { data: group } = await supabase
    .from('groups')
    .select('id, features')
    .eq('organization_id', org.id)
    .eq('group_type', 'chapter')
    .single()
  if (!group) throw new Error('chapter group not found')

  const features = (group.features ?? {}) as Record<string, boolean>
  if (features.budget) {
    console.log('budget feature already enabled')
    return
  }

  features.budget = true
  const { error } = await supabase.from('groups').update({ features }).eq('id', group.id)
  if (error) throw new Error(`Failed to update: ${error.message}`)
  console.log('budget feature enabled for chapter group')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
