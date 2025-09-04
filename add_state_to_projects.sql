-- Add state field to projects table for state-based filtering
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Telangana';

-- Create index for better performance on state filtering
CREATE INDEX IF NOT EXISTS idx_projects_state ON public.projects(state);

-- Update existing projects to have a default state if none exists
UPDATE public.projects 
SET state = 'Telangana' 
WHERE state IS NULL;
