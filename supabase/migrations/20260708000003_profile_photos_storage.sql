-- Profile photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true);

-- Authenticated users can upload to their own folder (keyed by person_id)
CREATE POLICY "profile_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

-- Authenticated users can update their own photos
CREATE POLICY "profile_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

-- Authenticated users can delete their own photos
CREATE POLICY "profile_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

-- Anyone can read profile photos (public bucket)
CREATE POLICY "profile_photos_select" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'profile-photos');
