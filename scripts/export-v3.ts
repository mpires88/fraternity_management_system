/**
 * Export v3 data from the dev Supabase project to a JSON file.
 *
 * Dumps all org-structure and membership data in FK-safe insertion order.
 * The companion `import-v3.ts` reads this file and inserts into a target project.
 *
 * Run:  npx tsx --env-file=.env.local scripts/export-v3.ts
 * Output: scripts/export-v3-data.json (gitignored — contains real PII)
 */

import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function fetchAll(table: string, select = '*', filter?: (q: any) => any) {
  let query = supabase.from(table).select(select)
  if (filter) query = filter(query)
  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`)
  console.log(`  ${table}: ${data.length} rows`)
  return data
}

async function main() {
  console.log(`Exporting v3 data from ${url}...\n`)

  const orgRelationshipTypes = await fetchAll('org_relationship_types')
  const statusDefinitions = await fetchAll('status_definitions')
  const parentOrganizations = await fetchAll('parent_organizations')
  const organizations = await fetchAll('organizations')
  const groups = await fetchAll('groups')
  const nationalOrgTemplates = await fetchAll('national_org_templates')
  const roleTypes = await fetchAll('role_types')
  const persons = await fetchAll('persons')
  const organizationAdmins = await fetchAll('organization_admins')
  const termDefinitions = await fetchAll('term_definitions')
  const terms = await fetchAll('terms')
  const pledgeClasses = await fetchAll('pledge_classes')
  const groupMemberships = await fetchAll('group_memberships')
  const groupRelationships = await fetchAll('group_relationships')

  // Also export auth users (email + id mapping, no passwords)
  console.log('\n  Fetching auth users...')
  const authUsers: { id: string; email: string }[] = []
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Failed to list auth users: ${error.message}`)
    for (const u of data.users) {
      if (u.email) authUsers.push({ id: u.id, email: u.email })
    }
    if (data.users.length < perPage) break
    page++
  }
  console.log(`  auth_users: ${authUsers.length} users`)

  const exportData = {
    _meta: {
      exportedAt: new Date().toISOString(),
      sourceUrl: url,
      version: 'v3',
    },
    authUsers,
    orgRelationshipTypes,
    statusDefinitions,
    parentOrganizations,
    organizations,
    groups,
    nationalOrgTemplates,
    roleTypes,
    persons,
    organizationAdmins,
    termDefinitions,
    terms,
    pledgeClasses,
    groupMemberships,
    groupRelationships,
  }

  const outPath = 'scripts/export-v3-data.json'
  writeFileSync(outPath, JSON.stringify(exportData, null, 2))
  console.log(
    `\nExported to ${outPath} (${Math.round(JSON.stringify(exportData).length / 1024)} KB)`
  )
  console.log('This file contains PII — do not commit it.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
