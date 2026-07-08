CREATE TABLE profile_change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  group_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  field_name      text NOT NULL,
  current_value   text,
  requested_value text NOT NULL,
  reason          text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     uuid REFERENCES persons(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT change_requests_reviewed_consistency CHECK (
    (reviewed_by IS NULL AND reviewed_at IS NULL AND status = 'pending')
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND status != 'pending')
  )
);

CREATE INDEX idx_change_requests_person ON profile_change_requests(person_id);
CREATE INDEX idx_change_requests_group_status ON profile_change_requests(group_id, status);

ALTER TABLE profile_change_requests ENABLE ROW LEVEL SECURITY;

-- Person can see their own requests
CREATE POLICY "change_requests_own_select" ON profile_change_requests
  FOR SELECT TO authenticated
  USING (person_id = (SELECT get_my_person_id()));

-- Admins can see all requests in their groups
CREATE POLICY "change_requests_admin_select" ON profile_change_requests
  FOR SELECT TO authenticated
  USING (group_id IN (SELECT get_my_admin_group_ids()));

-- Person can create requests for themselves
CREATE POLICY "change_requests_insert" ON profile_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (person_id = (SELECT get_my_person_id()));

-- Admins can update (approve/reject)
CREATE POLICY "change_requests_admin_update" ON profile_change_requests
  FOR UPDATE TO authenticated
  USING (group_id IN (SELECT get_my_admin_group_ids()));
