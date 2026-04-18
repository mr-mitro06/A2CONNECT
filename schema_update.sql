-- 5. Create Storage Bucket for Audio Messages
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', true) 
ON CONFLICT (id) DO NOTHING;

-- Policies for public media (Since URLs are unguessable, this acts as the first layer. The URLs are then encrypted via E2E)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access to Media Storage' AND tablename = 'objects') THEN
    CREATE POLICY "Public Access to Media Storage" ON storage.objects FOR SELECT USING ( bucket_id = 'media' );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Insert to Media Storage' AND tablename = 'objects') THEN
    CREATE POLICY "Public Insert to Media Storage" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'media' );
  END IF;
END $$;
