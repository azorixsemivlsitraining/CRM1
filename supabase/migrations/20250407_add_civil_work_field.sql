-- Add civil work fields to project_analysis table
ALTER TABLE public.project_analysis
ADD COLUMN IF NOT EXISTS civil_work_cost DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS civil_work_segments JSONB DEFAULT '[]'::jsonb;

-- Add comment to document the structure
COMMENT ON COLUMN public.project_analysis.civil_work_segments IS 'Array of civil work items with structure: [{"label": "string", "amount": number}, ...]';
