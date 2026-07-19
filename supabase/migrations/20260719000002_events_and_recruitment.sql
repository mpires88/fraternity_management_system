-- ============================================================================
-- Phase 10.1 (schema portion): generic events + recruitment tables
--
-- Layout-pass decisions (user-approved): `events` is GENERIC — recruitment is
-- its first consumer (kind = 'recruitment'); event_categories finally gets its
-- consumer via category_id. Prospects are NOT persons: persons are permanent
-- identities, prospects are purgeable pipeline records. Tradition-neutral
-- naming (prospects / prospect_feedback; pipeline column is `status`).
--
-- prospect_feedback deliberately has NO audit trigger: feedback is
-- hard-deleted on bid acceptance and purgeable per term — an audit copy would
-- defeat the purge.
-- ============================================================================

-- ── events (GENERIC) ─────────────────────────────────────────────────────────

CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  term_id     uuid REFERENCES terms(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  location    text,
  kind        text NOT NULL DEFAULT 'other'
              CHECK (kind IN ('recruitment', 'meeting', 'social', 'service', 'other')),
  category_id uuid REFERENCES event_categories(id) ON DELETE SET NULL,
  created_by  uuid NOT NULL REFERENCES persons(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_group_term ON events(group_id, term_id);
CREATE INDEX idx_events_starts_at ON events(starts_at);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (group_id IN (SELECT get_my_group_ids()));

-- Admins manage all events; rush chairs manage recruitment events specifically
CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    group_id IN (SELECT get_my_admin_group_ids())
    OR (kind = 'recruitment' AND group_id IN (SELECT get_my_module_admin_group_ids('rush')))
  );

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (
    group_id IN (SELECT get_my_admin_group_ids())
    OR (kind = 'recruitment' AND group_id IN (SELECT get_my_module_admin_group_ids('rush')))
  );

CREATE POLICY "events_delete" ON events
  FOR DELETE USING (
    group_id IN (SELECT get_my_admin_group_ids())
    OR (kind = 'recruitment' AND group_id IN (SELECT get_my_module_admin_group_ids('rush')))
  );

CREATE TRIGGER events_audit
  AFTER UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── prospects ────────────────────────────────────────────────────────────────

CREATE TABLE prospects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  term_id             uuid NOT NULL REFERENCES terms(id),
  full_name           text NOT NULL,
  email               text,
  phone               text,
  school_year         text,
  status              text NOT NULL DEFAULT 'prospect'
                      CHECK (status IN ('prospect', 'offered', 'accepted', 'declined', 'withdrawn')),
  poll_id             uuid REFERENCES polls(id) ON DELETE SET NULL,
  converted_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  added_by            uuid NOT NULL REFERENCES persons(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_prospects_group_term_email
  ON prospects (group_id, term_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX idx_prospects_group_term ON prospects(group_id, term_id);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospects_select" ON prospects
  FOR SELECT USING (group_id IN (SELECT get_my_group_ids()));

CREATE POLICY "prospects_insert" ON prospects
  FOR INSERT WITH CHECK (group_id IN (SELECT get_my_module_admin_group_ids('rush')));

CREATE POLICY "prospects_update" ON prospects
  FOR UPDATE USING (group_id IN (SELECT get_my_module_admin_group_ids('rush')));

CREATE POLICY "prospects_delete" ON prospects
  FOR DELETE USING (group_id IN (SELECT get_my_module_admin_group_ids('rush')));

CREATE TRIGGER prospects_audit
  AFTER UPDATE OR DELETE ON prospects
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── event_prospect_attendance ────────────────────────────────────────────────
-- Cascades away with the prospect: the purge story stays airtight. Future
-- member attendance is a SIBLING table (event_person_attendance), never a
-- polymorphic merge.

CREATE TABLE event_prospect_attendance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  prospect_id   uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  checked_in_by uuid NOT NULL REFERENCES persons(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, prospect_id)
);

CREATE INDEX idx_event_prospect_attendance_prospect
  ON event_prospect_attendance(prospect_id);

ALTER TABLE event_prospect_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_prospect_attendance_select" ON event_prospect_attendance
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE group_id IN (SELECT get_my_group_ids()))
  );

-- Any member of the event's group can check a prospect in
CREATE POLICY "event_prospect_attendance_insert" ON event_prospect_attendance
  FOR INSERT WITH CHECK (
    checked_in_by = (SELECT get_my_person_id())
    AND event_id IN (SELECT id FROM events WHERE group_id IN (SELECT get_my_group_ids()))
  );

CREATE POLICY "event_prospect_attendance_delete" ON event_prospect_attendance
  FOR DELETE USING (
    event_id IN (SELECT id FROM events WHERE group_id IN (SELECT get_my_module_admin_group_ids('rush')))
  );

CREATE TRIGGER event_prospect_attendance_audit
  AFTER UPDATE OR DELETE ON event_prospect_attendance
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── prospect_feedback (NO audit trigger — purgeable by design) ───────────────

CREATE TABLE prospect_feedback (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  author_person_id uuid NOT NULL REFERENCES persons(id),
  body             text NOT NULL,
  rating           int CHECK (rating BETWEEN 1 AND 5),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_feedback_prospect ON prospect_feedback(prospect_id);

ALTER TABLE prospect_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospect_feedback_select" ON prospect_feedback
  FOR SELECT USING (
    prospect_id IN (SELECT id FROM prospects WHERE group_id IN (SELECT get_my_group_ids()))
  );

CREATE POLICY "prospect_feedback_insert" ON prospect_feedback
  FOR INSERT WITH CHECK (
    author_person_id = (SELECT get_my_person_id())
    AND prospect_id IN (SELECT id FROM prospects WHERE group_id IN (SELECT get_my_group_ids()))
  );

-- Append-only: no UPDATE policy. Delete own, or rush-manage for the purge.
CREATE POLICY "prospect_feedback_delete" ON prospect_feedback
  FOR DELETE USING (
    author_person_id = (SELECT get_my_person_id())
    OR prospect_id IN (SELECT id FROM prospects WHERE group_id IN (SELECT get_my_module_admin_group_ids('rush')))
  );

-- ── grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON events, prospects, event_prospect_attendance, prospect_feedback TO authenticated;
GRANT ALL ON events, prospects, event_prospect_attendance, prospect_feedback TO service_role;
