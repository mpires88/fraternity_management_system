-- ============================================================================
-- Phase 10.3: bid vote configuration
--
-- 1. parent_organizations.settings — national-level config (bid_vote_threshold
--    for the default required vote ratio, e.g. 1.0 for unanimous).
-- 2. prospects.is_legacy — simple flag; legacy prospects may use a different
--    threshold stored in groups.settings.legacy_bid_vote_threshold.
-- ============================================================================

ALTER TABLE parent_organizations
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;
