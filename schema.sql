-- Run this script in the Supabase SQL Editor to set up the A2Connect Database

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  name text NOT NULL,
  avatar_url text,
  online_status boolean DEFAULT false,
  last_seen timestamptz DEFAULT now()
);

-- Insert the 2 permitted users manually
INSERT INTO public.users (id, name, online_status) 
VALUES 
  ('user_abhi', 'Abhi', false),
  ('user_arya', 'Arya', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id text REFERENCES public.users(id) NOT NULL,
  receiver_id text REFERENCES public.users(id) NOT NULL,
  content text NOT NULL,
  type text DEFAULT 'text',
  status text DEFAULT 'sent',
  created_at timestamptz DEFAULT now()
);

-- 3. Enable Realtime tracking for 'messages' and 'users' safely
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN 
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; 
  END IF; 

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
  ) THEN 
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users; 
  END IF; 
END $$;

-- 4. Set up Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Safely create policies
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon read users' AND tablename = 'users') THEN
    CREATE POLICY "Allow anon read users" ON public.users FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon update users' AND tablename = 'users') THEN
    CREATE POLICY "Allow anon update users" ON public.users FOR UPDATE USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon all messages' AND tablename = 'messages') THEN
    CREATE POLICY "Allow anon all messages" ON public.messages FOR ALL USING (true);
  END IF;
END $$;

-- 5. Storage Configuration (Bucket: media)
-- This creates the bucket and allows full access to authenticated/anon users for media sharing
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', true) 
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Full access to media bucket' AND tablename = 'objects') THEN
    CREATE POLICY "Full access to media bucket"
    ON storage.objects FOR ALL
    USING ( bucket_id = 'media' )
    WITH CHECK ( bucket_id = 'media' );
  END IF;
END $$;
