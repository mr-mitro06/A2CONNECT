-- Run this in the Supabase SQL Editor to fix real-time reaction/pin/star syncing
ALTER TABLE public.messages REPLICA IDENTITY FULL;
