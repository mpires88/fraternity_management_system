-- ============================================================================
-- Claim token lockdown (security fix)
--
-- claim_tokens_select_by_token was USING (true) for anon + authenticated:
-- every invite's secret token, email, and person/group ids were readable
-- platform-wide through the REST API, and combined with the (previously)
-- unbound claim action this allowed cross-tenant account takeover.
--
-- Token lookups now happen exclusively server-side with the service role
-- (actions/auth/claim-record.action.ts); group admins keep their scoped
-- select policy from 20260708000002.
-- ============================================================================

DROP POLICY IF EXISTS "claim_tokens_select_by_token" ON claim_tokens;
