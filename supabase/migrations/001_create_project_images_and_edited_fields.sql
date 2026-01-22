-- Enable pgcrypto for gen_random_uuid(); Supabase usually has this, but safe to ensure
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create project_images table
CREATE TABLE IF NOT EXISTS project_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  path text NOT NULL,
  name text,
  uploaded_by text,
  uploaded_at timestamptz DEFAULT now()
);

-- Add edited_by and edited_at to chitoor_projects
ALTER TABLE IF EXISTS chitoor_projects
  ADD COLUMN IF NOT EXISTS edited_by text,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Optional: grant select/insert/delete on project_images to authenticated role (uncomment if desired)
-- GRANT SELECT, INSERT, DELETE ON project_images TO authenticated;
