-- ============================================================================
-- Prospect photos — an optional headshot on the recruitment board.
--
-- Private bucket (user-approved 2026-07-21): prospect data is sensitive PII
-- that's purged on bid acceptance, so photos are authenticated-read only (not
-- public like member avatars) and member-uploadable to the uploader's own
-- folder. Display uses short-lived signed URLs; purge/delete runs server-side
-- via the service role.
-- ============================================================================

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS photo_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('prospect-photos', 'prospect-photos', false);

-- Upload/replace/remove your own uploads (path keyed by uploader person_id)
CREATE POLICY "prospect_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'prospect-photos'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

CREATE POLICY "prospect_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'prospect-photos'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

CREATE POLICY "prospect_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'prospect-photos'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

-- Any signed-in member can read (for signed-URL generation on the board)
CREATE POLICY "prospect_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'prospect-photos');
