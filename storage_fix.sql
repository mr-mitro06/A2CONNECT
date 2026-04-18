-- Run in Supabase SQL Editor to enable storage policies for the media bucket
-- Enable RLS on storage objects
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to upload to media bucket
DROP POLICY IF EXISTS "Allow anon uploads" ON storage.objects;
CREATE POLICY "Allow anon uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media');

-- Allow anyone to update their own uploads (basic anon update)
DROP POLICY IF EXISTS "Allow anon updates" ON storage.objects;
CREATE POLICY "Allow anon updates" ON storage.objects
  FOR UPDATE USING (bucket_id = 'media');

-- Allow anyone to read from media bucket
DROP POLICY IF EXISTS "Allow anon reads" ON storage.objects;
CREATE POLICY "Allow anon reads" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

-- Allow anyone to delete from media bucket (for cleanup)
DROP POLICY IF EXISTS "Allow anon deletes" ON storage.objects;
CREATE POLICY "Allow anon deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'media');
