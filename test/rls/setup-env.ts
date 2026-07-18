import { readFileSync } from 'node:fs'
import path from 'node:path'

// Vitest does not load .env.local; parse just the public vars we need.
// (cwd is the project root when run via `npm run test:rls`.)
const envPath = path.resolve(process.cwd(), '.env.local')
const content = readFileSync(envPath, 'utf-8')

for (const line of content.split(/\r?\n/)) {
  const match = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=(.+)$/)
  if (match) {
    process.env[match[1]] = match[2].trim()
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error(
    'test/rls needs NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  )
}
