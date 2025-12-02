-- Enable RLS on user_departments table
-- The policies already exist but RLS is not enabled, so they have no effect
-- This migration simply enables RLS to activate the existing policies

-- Existing policies that will be activated:
-- 1. "Admins manage department memberships" - Admin kan administrere alle avdelingsmedlemskap
-- 2. "Users view own department memberships" - Brukere kan se sine egne avdelinger

-- Enable Row Level Security
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- Verify: After running this, test the following:
-- 1. Users should be able to view their own department memberships
-- 2. Admin users should be able to manage all department memberships
-- 3. Service role (used by the app) bypasses RLS automatically

