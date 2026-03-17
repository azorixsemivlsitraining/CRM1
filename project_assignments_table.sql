-- Create project_assignments table for admin project assignment management
CREATE TABLE IF NOT EXISTS public.project_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignee_email TEXT NOT NULL,
    assignee_name TEXT NOT NULL,
    assigned_states TEXT[] NOT NULL DEFAULT '{}',
    project_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for project_assignments table (admin only access)
CREATE POLICY "Enable read access for admin users" ON public.project_assignments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Enable insert access for admin users" ON public.project_assignments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Enable update access for admin users" ON public.project_assignments
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Enable delete access for admin users" ON public.project_assignments
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_assignments_assignee_email ON public.project_assignments(assignee_email);
CREATE INDEX IF NOT EXISTS idx_project_assignments_assigned_states ON public.project_assignments USING GIN(assigned_states);
CREATE INDEX IF NOT EXISTS idx_project_assignments_created_at ON public.project_assignments(created_at);

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at_project_assignments
    BEFORE UPDATE ON public.project_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Add unique constraint to prevent duplicate assignments
ALTER TABLE public.project_assignments 
ADD CONSTRAINT unique_assignee_email UNIQUE (assignee_email);
