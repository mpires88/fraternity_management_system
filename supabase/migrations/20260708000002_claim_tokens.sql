-- ============================================================================
-- Claim tokens: invite → claim flow for member onboarding
--
-- Replaces the old "create dummy auth user" invite pattern.
-- New persons get a generated UUID (not tied to auth.users).
-- ============================================================================

-- ── 1. Drop the FK that tied persons.id to auth.users.id ─────────────────────

ALTER TABLE persons DROP CONSTRAINT IF EXISTS persons_id_fkey;

-- ── 2. Claim tokens table ────────────────────────────────────────────────────

CREATE TABLE claim_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  token       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES persons(id),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  claimed_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_claim_tokens_token ON claim_tokens(token);
CREATE INDEX idx_claim_tokens_person ON claim_tokens(person_id);

ALTER TABLE claim_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim_tokens_select_by_token" ON claim_tokens
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "claim_tokens_admin_select" ON claim_tokens
  FOR SELECT TO authenticated
  USING (group_id IN (SELECT get_my_admin_group_ids()));
