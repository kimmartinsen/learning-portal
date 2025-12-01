-- Enable RLS on checklist_items table
-- The policies already exist but RLS is not enabled, so they have no effect
-- This migration simply enables RLS to activate the existing policies

-- Enable Row Level Security
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- Verify: After running this, test the following:
-- 1. Users should be able to view checklist items
-- 2. Admin users should be able to manage all checklist items
-- 3. Service role (used by the app) bypasses RLS automatically

