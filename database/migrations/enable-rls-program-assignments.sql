-- Enable RLS on program_assignments table
-- The policies already exist but RLS is not enabled, so they have no effect
-- This migration simply enables RLS to activate the existing policies

-- Enable Row Level Security
ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;

-- Verify: After running this, test the following:
-- 1. Users should be able to view their own assignments
-- 2. Instructors should be able to manage assignments they're responsible for
-- 3. Admin users should be able to manage all assignments
-- 4. Service role (used by the app) bypasses RLS automatically

