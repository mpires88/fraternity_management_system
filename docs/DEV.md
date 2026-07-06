# Dev environment runbook

How to run, verify, and change this app locally. Read this once at the start of every
implementation session. PLAN.md §0 defines the session protocol; this file defines the
environment it runs in.

## The stack at a glance

- **App:** `npm run dev` → http://localhost:3000. Login page is `/login`.
  URL shape after login: `/[parent]/[org]/[group]/<feature>` (e.g. `.../dashboard`).
- **Database:** a **hosted** Supabase dev project, ref `grojoxrglzkxpenizmax`, linked
  via the CLI (`supabase/.temp/project-ref`) and targeted by `.env.local`. There is
  **no local Docker database in use** — `supabase/config.toml` exists for CLI tooling,
  and `supabase db push` / `npm run types:db` both operate on the linked project.
- **`.env.local`** (gitignored, required): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Sentry vars optional
  in dev.

### ⚠ Before the first session: check the database is alive

As of 2026-07-06 the project URL (`grojoxrglzkxpenizmax.supabase.co`) does **not
resolve** — free-tier Supabase projects are paused after ~1 week of inactivity and
must be restored at
https://supabase.com/dashboard/project/grojoxrglzkxpenizmax before anything works.
If the project was deleted rather than paused: create a new project, `supabase link`
it, `supabase db push` (all migrations apply cleanly to an empty project), update
`.env.local` with the new URL/keys, and run the seed script (once task 0.9 rewrites
it). Verify with: `curl https://<ref>.supabase.co/auth/v1/health`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run check` | Biome lint/format + tsgo typecheck + Vitest — the finish line for every task |
| `npm run check:full` | `check` + production build |
| `npm run test:watch` | Vitest in watch mode |
| `npm run types:db` | Regenerate `lib/supabase/types.ts` from the **linked** project |

## Schema change recipe (exact sequence, no substitutions)

1. Create `supabase/migrations/<YYYYMMDDNNNNNN>_descriptive_name.sql` — copy the
   numbering style of the existing files (date prefix + counter). Never edit a
   migration that has already been pushed; always add a new file.
2. `supabase db push`
3. `npm run types:db`
4. Regenerate the reference: `supabase db dump --schema public` →
   `supabase/schema-reference.sql`, then restore the header comment at the top of
   that file explaining it is a reference, not a migration.
5. `npm run check` (and commit the migration + types + reference together with the
   feature code).

Never hand-edit `lib/supabase/types.ts` — it is generated output.

## Test users

All seeded users share the password `password123`.

- `admin@test.com` — platform admin + full-access member (the primary login).
- `jake@`, `ryan@`, `cole@`, `dylan@`, `marcus@`, `ben@` (all `@test.com`) — roster
  fill from the original seed; they may or may not have survived the v2→v3 schema
  migrations. Check Studio → Table Editor if in doubt.

**Caveat:** `scripts/seed-dev.ts` predates the v3 schema (it writes to dropped tables
like `orgs` and `membership_types`) and will fail if run. Task 0.9 in PLAN.md rewrites
it. Until then, the hosted database's current contents are the only seed.

Verification needs three personas — task 0.9's seed must guarantee all three exist:
1. **Officer**: active membership with a full-access (`access_level = 'full'`) role.
2. **Member**: active membership, non-full access — sees own data only.
3. **Outsider**: valid login with *no* membership in the target group — must see
   nothing of it.

## Verifying in the running app

- "Done" means the accept criterion was exercised in the browser, not that
  `npm run check` passed. Drive the actual flow.
- Find the live URL slugs in Studio (`parent_organizations`, `organizations`,
  `groups` tables) rather than guessing.
- **RLS verification is not UI verification.** To prove a member can't touch other
  people's rows, act as that member (second browser profile / incognito logged in as
  the plain member) or hit the REST API with that user's JWT. Hidden buttons prove
  nothing.

## Email flows (task 0.4, Phase 3)

The hosted project uses Supabase's built-in mailer: it sends **real email**, is
rate-limited to a handful per hour, and `@test.com` addresses receive nothing.
Options, in order of preference:
1. Test reset/invite flows with a real inbox (e.g. the owner's address).
2. Run the full local stack for that session: `supabase start` (Docker required),
   point `.env.local` at the printed local URL/keys, read outbound mail in the
   inbucket UI at http://127.0.0.1:54324. Switch `.env.local` back afterward.

## Windows environment notes

- The repo path contains a space (`Git Clones`) — always quote absolute paths in
  commands.
- The default shell is PowerShell 5.1: `&&` does not chain commands; use `;` or
  separate invocations, or prefer `npm run <script>`.
- The repo is LF; git's CRLF warnings on Windows are harmless — do not "fix" line
  endings.
- Node 24 / npm are on PATH; scripts run with `npx tsx --env-file=.env.local
  scripts/<name>.ts` (tsx is not a dependency; npx fetches it).
