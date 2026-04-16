/**
 * ============================================
 * PROJECT ANALYSIS TABLE SETUP
 * ============================================
 * 
 * Complete SQL file for:
 * - Creating project_analysis table
 * - Setting up Row Level Security (RLS)
 * - Creating indexes for performance
 * - Syncing with project tiles
 * - Enabling data persistence in Supabase
 *
 * Usage: Copy entire content to Supabase SQL Editor and execute
 */

-- ============================================
-- 1. CREATE PROJECT_ANALYSIS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.project_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UNIQUE NOT NULL,
  sl_no BIGINT DEFAULT 0,
  customer_name TEXT,
  mobile_no TEXT,
  project_capacity DECIMAL(10,2) DEFAULT 0,
  total_quoted_cost DECIMAL(15,2) DEFAULT 0,
  
  -- Cost Breakdown Fields
  application_charges DECIMAL(12,2) DEFAULT 0,
  modules_cost DECIMAL(12,2) DEFAULT 0,
  inverter_cost DECIMAL(12,2) DEFAULT 0,
  structure_cost DECIMAL(12,2) DEFAULT 0,
  hardware_cost DECIMAL(12,2) DEFAULT 0,
  electrical_equipment DECIMAL(12,2) DEFAULT 0,
  
  -- Transport Costs with Breakdown
  transport_segment DECIMAL(12,2) DEFAULT 0,
  transport_segments JSONB DEFAULT '[]'::jsonb COMMENT 'Array: [{"label": "Delivery", "amount": 1000}, ...]',
  transport_total DECIMAL(12,2) DEFAULT 0,
  
  -- Installation & Other Costs
  installation_cost DECIMAL(12,2) DEFAULT 0,
  subsidy_application DECIMAL(12,2) DEFAULT 0,
  misc_dept_charges DECIMAL(12,2) DEFAULT 0,
  
  -- Dept Charges with Breakdown
  dept_charges DECIMAL(12,2) DEFAULT 0,
  dept_charges_segments JSONB DEFAULT '[]'::jsonb COMMENT 'Array: [{"label": "Permit", "amount": 500}, ...]',
  
  -- Civil Work with Breakdown
  civil_work_cost DECIMAL(12,2) DEFAULT 0,
  civil_work_segments JSONB DEFAULT '[]'::jsonb COMMENT 'Array: [{"label": "Foundation", "amount": 2000}, ...]',
  
  -- Financial Summary Fields
  total_exp DECIMAL(15,2) DEFAULT 0,
  payment_received DECIMAL(15,2) DEFAULT 0,
  pending_payment DECIMAL(15,2) DEFAULT 0,
  profit_right_now DECIMAL(15,2) DEFAULT 0,
  overall_profit DECIMAL(15,2) DEFAULT 0,
  
  -- Project Timeline
  project_start_date TEXT,
  completion_date TEXT,
  payment_dates TEXT[] DEFAULT '{}'::TEXT[],
  
  -- Categorization
  state TEXT COMMENT 'TG, AP, Chitoor, or Other',
  
  -- Audit Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT fk_project_id FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- ============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Unique index on project_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_project_analysis_project_id
ON public.project_analysis(project_id)
WHERE project_id IS NOT NULL;

-- Index for filtering by state (TG, AP, Chitoor, etc)
CREATE INDEX IF NOT EXISTS idx_project_analysis_state
ON public.project_analysis(state);

-- Index for ordering by most recently updated
CREATE INDEX IF NOT EXISTS idx_project_analysis_updated_at
ON public.project_analysis(updated_at DESC);

-- Index for customer name search
CREATE INDEX IF NOT EXISTS idx_project_analysis_customer_name
ON public.project_analysis(customer_name);

-- Index for mobile search
CREATE INDEX IF NOT EXISTS idx_project_analysis_mobile_no
ON public.project_analysis(mobile_no);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.project_analysis ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to SELECT (read) all rows
CREATE POLICY "Enable read access for authenticated users"
  ON public.project_analysis
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy 2: Allow authenticated users to INSERT (create) new rows
CREATE POLICY "Enable insert for authenticated users"
  ON public.project_analysis
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy 3: Allow authenticated users to UPDATE (edit) rows
CREATE POLICY "Enable update for authenticated users"
  ON public.project_analysis
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy 4: Allow authenticated users to DELETE rows
CREATE POLICY "Enable delete for authenticated users"
  ON public.project_analysis
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================
-- 4. CREATE TRIGGER FOR AUTO-UPDATE TIMESTAMP
-- ============================================

CREATE OR REPLACE FUNCTION update_project_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_analysis_timestamp ON public.project_analysis;

CREATE TRIGGER trigger_update_project_analysis_timestamp
  BEFORE UPDATE ON public.project_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_project_analysis_updated_at();

-- ============================================
-- 5. CREATE FUNCTION TO AUTO-SYNC NEW PROJECTS
-- ============================================

CREATE OR REPLACE FUNCTION sync_new_projects_to_analysis()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new project is created, automatically create a project_analysis record
  INSERT INTO public.project_analysis (
    id,
    project_id,
    sl_no,
    customer_name,
    mobile_no,
    project_capacity,
    total_quoted_cost,
    payment_received,
    pending_payment,
    state,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,
    0,
    COALESCE(NEW.customer_name, ''),
    COALESCE(NEW.phone, ''),
    COALESCE(NEW.kwh, 0),
    COALESCE(NEW.proposal_amount, 0),
    COALESCE(NEW.advance_payment, 0) + COALESCE(NEW.paid_amount, 0),
    COALESCE(NEW.balance_amount, 0),
    COALESCE(NEW.state, 'Other'),
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (project_id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    mobile_no = EXCLUDED.mobile_no,
    project_capacity = EXCLUDED.project_capacity,
    total_quoted_cost = EXCLUDED.total_quoted_cost,
    payment_received = EXCLUDED.payment_received,
    pending_payment = EXCLUDED.pending_payment,
    state = EXCLUDED.state,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_new_projects_to_analysis ON public.projects;

-- Create trigger to sync when new project is inserted
CREATE TRIGGER trigger_sync_new_projects_to_analysis
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_new_projects_to_analysis();

-- ============================================
-- 6. CREATE VIEW FOR ENHANCED PROJECT DATA
-- ============================================

CREATE OR REPLACE VIEW public.project_analysis_view AS
SELECT
  pa.id,
  pa.project_id,
  pa.sl_no,
  pa.customer_name,
  pa.mobile_no,
  pa.project_capacity,
  pa.total_quoted_cost,
  pa.application_charges,
  pa.modules_cost,
  pa.inverter_cost,
  pa.structure_cost,
  pa.hardware_cost,
  pa.electrical_equipment,
  pa.transport_segment,
  pa.transport_segments,
  pa.transport_total,
  pa.installation_cost,
  pa.subsidy_application,
  pa.misc_dept_charges,
  pa.dept_charges,
  pa.dept_charges_segments,
  pa.civil_work_cost,
  pa.civil_work_segments,
  pa.total_exp,
  pa.payment_received,
  pa.pending_payment,
  pa.profit_right_now,
  pa.overall_profit,
  pa.project_start_date,
  pa.completion_date,
  pa.payment_dates,
  pa.state,
  pa.created_at,
  pa.updated_at,
  -- Join with projects table to get additional info
  p.status,
  p.created_at as project_created_at
FROM public.project_analysis pa
LEFT JOIN public.projects p ON pa.project_id = p.id
ORDER BY pa.updated_at DESC;

-- ============================================
-- 7. SAMPLE DATA (Optional - Remove after testing)
-- ============================================

-- Insert sample project analysis records if table is empty
INSERT INTO public.project_analysis (
  project_id,
  sl_no,
  customer_name,
  mobile_no,
  project_capacity,
  total_quoted_cost,
  application_charges,
  modules_cost,
  inverter_cost,
  structure_cost,
  hardware_cost,
  electrical_equipment,
  transport_segments,
  transport_total,
  installation_cost,
  subsidy_application,
  misc_dept_charges,
  dept_charges_segments,
  civil_work_segments,
  total_exp,
  payment_received,
  pending_payment,
  profit_right_now,
  overall_profit,
  project_start_date,
  completion_date,
  state,
  created_at,
  updated_at
) SELECT
  gen_random_uuid(),
  ROW_NUMBER() OVER (ORDER BY p.created_at),
  p.customer_name,
  p.phone,
  p.kwh,
  p.proposal_amount,
  0,
  0,
  0,
  0,
  0,
  0,
  '[]'::jsonb,
  0,
  0,
  0,
  0,
  '[]'::jsonb,
  '[]'::jsonb,
  0,
  COALESCE(p.advance_payment, 0) + COALESCE(p.paid_amount, 0),
  COALESCE(p.balance_amount, 0),
  0,
  0,
  NULL,
  NULL,
  COALESCE(p.state, 'Other'),
  p.created_at,
  p.updated_at
FROM public.projects p
WHERE p.status != 'deleted'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_analysis pa WHERE pa.project_id = p.id
  )
LIMIT 1000;

-- ============================================
-- 8. VERIFICATION QUERIES
-- ============================================

-- Check table creation
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'project_analysis';

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'project_analysis' 
ORDER BY indexname;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'project_analysis';

-- Check data count
SELECT COUNT(*) as total_records FROM public.project_analysis;

-- Check latest records
SELECT 
  project_id,
  customer_name,
  mobile_no,
  state,
  total_quoted_cost,
  total_exp,
  profit_right_now,
  updated_at
FROM public.project_analysis
ORDER BY updated_at DESC
LIMIT 10;

-- ============================================
-- NOTES & DOCUMENTATION
-- ============================================

/**
 * TABLE STRUCTURE EXPLANATION:
 * 
 * Core Identifiers:
 *   - id: Unique record identifier (UUID)
 *   - project_id: Links to projects.id (UNIQUE constraint)
 *   - sl_no: Serial number for display
 *
 * Customer Info:
 *   - customer_name: From projects table
 *   - mobile_no: Customer contact number
 *   - state: TG (Telangana), AP (Andhra Pradesh), Chitoor, or Other
 *
 * Project Specs:
 *   - project_capacity: kW capacity of solar project
 *   - total_quoted_cost: Original quoted amount
 *
 * Cost Breakdown (all in decimal 12,2):
 *   - Individual costs: application, modules, inverter, structure, etc.
 *   - Segment costs: transport_segments, dept_charges_segments, civil_work_segments (JSONB arrays)
 *   - Format: [{"label": "item name", "amount": 1000}, ...]
 *
 * Financial Summary (auto-calculated):
 *   - total_exp: Sum of all expenses
 *   - payment_received: Amount received from customer
 *   - pending_payment: Amount still due
 *   - profit_right_now: payment_received - total_exp
 *   - overall_profit: total_quoted_cost - total_exp
 *
 * Timeline:
 *   - project_start_date: When project started
 *   - completion_date: Expected/actual completion
 *   - payment_dates: Array of payment timestamps
 *
 * RLS POLICIES:
 *   - All policies allow 'authenticated' users (logged-in users)
 *   - Can READ, INSERT, UPDATE, DELETE
 *   - Remove policies to restrict specific operations
 *
 * AUTO-SYNC TRIGGER:
 *   - When new project added to 'projects' table
 *   - Automatically creates project_analysis record
 *   - Copies basic data (customer, cost, state)
 *   - User can then edit/add detailed cost breakdown
 *
 * NEXT STEPS IN APP:
 *   1. App fetches project_analysis via Supabase client
 *   2. User edits fields in UI (cost breakdown, etc)
 *   3. App saves changes back to Supabase
 *   4. Realtime listeners update other users' views
 *   5. Data persists permanently in Supabase database
 */

-- ============================================
-- END OF SETUP
-- ============================================
