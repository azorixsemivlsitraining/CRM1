-- Add lead_finished_by_name column to chitoor_projects table
ALTER TABLE public.chitoor_projects 
ADD COLUMN lead_finished_by_name TEXT;

-- Create index for lead_finished_by_name for better query performance
CREATE INDEX IF NOT EXISTS idx_chitoor_projects_lead_finished_by_name ON public.chitoor_projects(lead_finished_by_name);

-- Comment on new column
COMMENT ON COLUMN public.chitoor_projects.lead_finished_by_name IS 'Name of the person responsible for finishing the lead';
