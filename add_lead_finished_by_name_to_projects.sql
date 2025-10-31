-- Add lead_finished_by_name column to projects table
ALTER TABLE public.projects 
ADD COLUMN lead_finished_by_name TEXT;

-- Create index for lead_finished_by_name for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_lead_finished_by_name ON public.projects(lead_finished_by_name);

-- Comment on new column
COMMENT ON COLUMN public.projects.lead_finished_by_name IS 'Name of the person responsible for finishing the lead';
