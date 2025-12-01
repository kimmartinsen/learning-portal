-- Enable RLS on profiles table
-- The policies already exist but RLS is not enabled, so they have no effect
-- This migration simply enables RLS to activate the existing policies

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Verify: After running this, test the following:
-- 1. Users should be able to view/update their own profile
-- 2. Users should be able to view company profiles
-- 3. Admin users should be able to manage all profiles
-- 4. Service role (used by the app) bypasses RLS automatically

