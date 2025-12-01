-- Enable RLS on checklist_item_status table
-- The policies already exist but RLS is not enabled, so they have no effect
-- This migration simply enables RLS to activate the existing policies

-- Enable Row Level Security
ALTER TABLE public.checklist_item_status ENABLE ROW LEVEL SECURITY;

-- Verify: After running this, test the following:
-- 1. Regular users should only see their own item statuses
-- 2. Admin users should be able to manage all item statuses
-- 3. Service role (used by the app) bypasses RLS automatically

