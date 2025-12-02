-- Enable RLS on training_programs table
-- The policies already exist but RLS is not enabled, so they have no effect
-- This migration simply enables RLS to activate the existing policies

-- Enable Row Level Security
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

-- Verify: After running this, test the following:
-- 1. Users should be able to view company programs
-- 2. Instructors should be able to manage their own programs
-- 3. Admin users should be able to manage all programs
-- 4. Service role (used by the app) bypasses RLS automatically


