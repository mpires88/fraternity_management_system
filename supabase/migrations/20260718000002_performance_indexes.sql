-- ============================================================================
-- Performance indexes (from the July 2026 performance audit)
--
-- Postgres does not auto-index FK columns. These cover the hot paths:
-- RLS policy lookups (persons_select self-joins group_memberships on
-- group_id on every persons read), roster/dashboard queries, per-person
-- assignment lookups, and the person-scoped branches of poll/vote policies.
-- ============================================================================

-- Hottest: persons_select RLS self-join + roster + dashboard counts
CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);

-- getMyAssignments (every dashboard render) + assignment RLS self-branch
CREATE INDEX IF NOT EXISTS idx_requirement_assignments_person
  ON requirement_assignments(person_id);

-- Requirements list per group/term (page + RLS)
CREATE INDEX IF NOT EXISTS idx_requirements_group_term ON requirements(group_id, term_id);

-- Dashboard officer probes + audience expansion
CREATE INDEX IF NOT EXISTS idx_position_assignments_group_term
  ON position_assignments(group_id, term_id);
CREATE INDEX IF NOT EXISTS idx_position_assignments_person
  ON position_assignments(person_id);

-- Person-scoped RLS branches on ballots/eligibility
CREATE INDEX IF NOT EXISTS idx_votes_person ON votes(person_id);
CREATE INDEX IF NOT EXISTS idx_poll_participants_person ON poll_participants(person_id);

-- Subgroup audience expansion joins
CREATE INDEX IF NOT EXISTS idx_subgroup_members_person ON subgroup_members(person_id);
CREATE INDEX IF NOT EXISTS idx_subgroup_members_subgroup ON subgroup_members(subgroup_id);

-- Audit-history reads as data_change_log grows unbounded
CREATE INDEX IF NOT EXISTS idx_data_change_log_changed_at ON data_change_log(changed_at);
