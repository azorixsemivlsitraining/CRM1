-- Add lead_source and lead_finished_by columns to chitoor_projects table
ALTER TABLE public.chitoor_projects 
ADD COLUMN lead_source TEXT,
ADD COLUMN lead_finished_by DATE;

-- Create index for lead_source for better query performance
CREATE INDEX IF NOT EXISTS idx_chitoor_projects_lead_source ON public.chitoor_projects(lead_source);
CREATE INDEX IF NOT EXISTS idx_chitoor_projects_lead_finished_by ON public.chitoor_projects(lead_finished_by);

-- Comment on new columns
COMMENT ON COLUMN public.chitoor_projects.lead_source IS 'Source of lead: Online, Referral, Advertisement, Direct, etc.';
COMMENT ON COLUMN public.chitoor_projects.lead_finished_by IS 'Target date to finish the lead/project';
