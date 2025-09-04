-- Add missing columns to support module- and region-level access control
-- This fixes cases where assignments save without module permissions,
-- causing ModuleGuard to show "No access" for modules like Operations/Finance.

-- Note: ALTER TABLE does not support IF NOT EXISTS (only ADD COLUMN does)
ALTER TABLE public.project_assignments
  ADD COLUMN IF NOT EXISTS module_access TEXT[] DEFAULT '{}'::text[];

-- Add region_access as JSONB to store per-state access levels { state: 'view'|'edit'|'admin' }
ALTER TABLE public.project_assignments
  ADD COLUMN IF NOT EXISTS region_access JSONB DEFAULT '{}'::jsonb;

-- Optional: indexes for faster lookups (safe if they already exist)
CREATE INDEX IF NOT EXISTS idx_project_assignments_module_access ON public.project_assignments USING GIN (module_access);
CREATE INDEX IF NOT EXISTS idx_project_assignments_region_access ON public.project_assignments USING GIN ((region_access));


