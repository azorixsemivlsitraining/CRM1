-- Add lead_source and lead_finished_by columns to projects table
ALTER TABLE public.projects 
ADD COLUMN lead_source TEXT,
ADD COLUMN lead_finished_by DATE;

-- Create index for lead_source for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_lead_source ON public.projects(lead_source);
CREATE INDEX IF NOT EXISTS idx_projects_lead_finished_by ON public.projects(lead_finished_by);

-- Comment on new columns
COMMENT ON COLUMN public.projects.lead_source IS 'Source of lead: Online, Referral, Advertisement, Direct, etc.';
COMMENT ON COLUMN public.projects.lead_finished_by IS 'Target date to finish the lead/project';
