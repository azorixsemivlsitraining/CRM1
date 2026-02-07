-- Create chitoor_projects table for Chitoor district projects
CREATE TABLE IF NOT EXISTS public.chitoor_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sl_no INTEGER,
    customer_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    date_of_order DATE NOT NULL,
    service_number TEXT,
    address_mandal_village TEXT NOT NULL,
    capacity DECIMAL NOT NULL,
    project_cost DECIMAL NOT NULL,
    amount_received DECIMAL,
    subsidy_scope TEXT,
    velugu_officer_payments DECIMAL,
    project_status TEXT DEFAULT 'Pending',
    material_sent_date DATE,
    balamuragan_payment DECIMAL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.chitoor_projects ENABLE ROW LEVEL SECURITY;

-- Create policies for chitoor_projects table
CREATE POLICY "Enable read access for authenticated users" ON public.chitoor_projects
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.chitoor_projects
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON public.chitoor_projects
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON public.chitoor_projects
    FOR DELETE
    TO authenticated
    USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chitoor_projects_customer_name ON public.chitoor_projects(customer_name);
CREATE INDEX IF NOT EXISTS idx_chitoor_projects_date_of_order ON public.chitoor_projects(date_of_order);
CREATE INDEX IF NOT EXISTS idx_chitoor_projects_project_status ON public.chitoor_projects(project_status);
CREATE INDEX IF NOT EXISTS idx_chitoor_projects_created_at ON public.chitoor_projects(created_at);

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at_chitoor_projects
    BEFORE UPDATE ON public.chitoor_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
