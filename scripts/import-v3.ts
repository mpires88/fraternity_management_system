/**
 * Import v3 data into a target Supabase project from the JSON export.
 *
 * Creates auth users (with a temporary password) and inserts all org-structure
 * and membership data in FK-safe order. Idempotent — skips rows that already exist.
 *
 * Usage:
 *   TARGET_URL=https://xxx.supabase.co \
 *   TARGET_SERVICE_KEY=eyJ... \
 *   npx tsx scripts/import-v3.ts [path/to/export-v3-data.json]
 *
 * Or to import into the same dev DB (re-seeding after a reset):
 *   npx tsx --env-file=.env.local scripts/import-v3.ts
 *   (uses NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY as defaults)
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.TARGET_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.TARGET_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
  console.error(
    'Set TARGET_URL + TARGET_SERVICE_KEY, or run with --env-file=.env.local for the dev DB'
  )
  process.exit(1)
}

const inputPath = process.argv[2] ?? 'scripts/export-v3-data.json'

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEMP_PASSWORD = 'ChangeMeOnFirstLogin1!'

interface ExportData {
  _meta: { exportedAt: string; sourceUrl: string; version: string }
  authUsers: { id: string; email: string }[]
  orgRelationshipTypes: any[]
  statusDefinitions: any[]
  parentOrganizations: any[]
  organizations: any[]
  groups: any[]
  nationalOrgTemplates: any[]
  roleTypes: any[]
  persons: any[]
  organizationAdmins: any[]
  termDefinitions: any[]
  terms: any[]
  pledgeClasses: any[]
  groupMemberships: any[]
  groupRelationships: any[]
}

async function upsertBatch(table: string, rows: any[], conflict = 'id') {
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (skipped)`)
    return
  }

  const batchSize = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflict, ignoreDuplicates: true })
    if (error) throw new Error(`${table} upsert failed at batch ${i}: ${error.message}`)
    inserted += batch.length
  }
  console.log(`  ${table}: ${inserted} rows`)
}

async function createAuthUsers(users: { id: string; email: string }[]) {
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existingIds = new Set(existing?.users?.map((u) => u.id) ?? [])

  let created = 0
  let skipped = 0
  for (const user of users) {
    if (existingIds.has(user.id)) {
      skipped++
      continue
    }
    const { error } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: TEMP_PASSWORD,
      email_confirm: true,
    })
    if (error) {
      if (error.message.includes('already been registered')) {
        skipped++
      } else {
        console.warn(`  Warning: auth user ${user.email}: ${error.message}`)
        skipped++
      }
    } else {
      created++
    }
  }
  console.log(`  auth_users: ${created} created, ${skipped} already existed`)
}

async function main() {
  console.log(`Importing v3 data into ${url}`)
  console.log(`Reading from ${inputPath}...\n`)

  const raw = readFileSync(inputPath, 'utf-8')
  const data: ExportData = JSON.parse(raw)

  console.log(`Export source: ${data._meta.sourceUrl}`)
  console.log(`Exported at: ${data._meta.exportedAt}\n`)

  if (url === data._meta.sourceUrl) {
    console.log('⚠  Target is the same as the export source — this will re-seed the dev DB.\n')
  }

  // 1. Auth users first (persons.id = auth.users.id)
  console.log('Creating auth users...')
  await createAuthUsers(data.authUsers)

  // 2. Reference tables (no FK deps)
  console.log('\nInserting reference data...')
  await upsertBatch('org_relationship_types', data.orgRelationshipTypes)
  await upsertBatch(
    'status_definitions',
    data.statusDefinitions.filter((s) => !s.group_id)
  )

  // 3. Org hierarchy
  console.log('\nInserting org hierarchy...')
  // parent_organizations has FKs to persons (approved_by, submitted_by) — null them
  // for initial insert, then update after persons are in
  const parentOrgsClean = data.parentOrganizations.map((p: any) => ({
    ...p,
    approved_by: null,
    submitted_by: null,
  }))
  await upsertBatch('parent_organizations', parentOrgsClean)
  await upsertBatch('organizations', data.organizations)
  await upsertBatch('groups', data.groups)
  await upsertBatch('national_org_templates', data.nationalOrgTemplates)

  // 4. Group-scoped config
  console.log('\nInserting group config...')
  await upsertBatch('role_types', data.roleTypes)
  await upsertBatch(
    'status_definitions',
    data.statusDefinitions.filter((s) => s.group_id)
  )
  await upsertBatch('term_definitions', data.termDefinitions)

  // 5. Persons (id = auth user id)
  console.log('\nInserting persons...')
  // Clear self-referential FKs for first pass
  const personsClean = data.persons.map((p: any) => ({
    ...p,
    big_id: null,
    emergency_contact_person_id: null,
    pledge_class_id: null,
  }))
  await upsertBatch('persons', personsClean)

  // 6. Now restore parent_organizations person FKs
  for (const p of data.parentOrganizations) {
    if (p.approved_by || p.submitted_by) {
      await supabase
        .from('parent_organizations')
        .update({ approved_by: p.approved_by, submitted_by: p.submitted_by })
        .eq('id', p.id)
    }
  }

  // 7. Terms and pledge classes
  console.log('\nInserting terms...')
  await upsertBatch('terms', data.terms)
  await upsertBatch('pledge_classes', data.pledgeClasses)

  // 8. Now restore persons self-refs (big_id, pledge_class_id)
  console.log('\nRestoring person cross-references...')
  let personUpdates = 0
  for (const p of data.persons) {
    if (p.big_id || p.emergency_contact_person_id || p.pledge_class_id) {
      await supabase
        .from('persons')
        .update({
          big_id: p.big_id,
          emergency_contact_person_id: p.emergency_contact_person_id,
          pledge_class_id: p.pledge_class_id,
        })
        .eq('id', p.id)
      personUpdates++
    }
  }
  console.log(`  persons: ${personUpdates} rows updated with cross-references`)

  // 9. Memberships and relationships
  console.log('\nInserting memberships...')
  await upsertBatch('organization_admins', data.organizationAdmins)
  await upsertBatch('group_memberships', data.groupMemberships)
  await upsertBatch('group_relationships', data.groupRelationships)

  console.log('\n--- Import complete! ---')
  console.log(`Target: ${url}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
