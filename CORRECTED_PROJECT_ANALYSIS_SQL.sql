/**
 * ============================================
 * PROJECT ANALYSIS TABLE SETUP - CORRECTED
 * ============================================
 * Supports both projects and chitoor_projects tables
 * Copy entire content to Supabase SQL Editor and execute
 */

-- ============================================
-- 1. DROP EXISTING TABLE (if needed for fresh start)
-- ============================================
-- UNCOMMENT ONLY IF YOU WANT TO START FRESH AND LOSE DATA
-- DROP TABLE IF EXISTS public.project_analysis CASCADE;

-- ============================================
-- 2. CREATE PROJECT_ANALYSIS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.project_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UNIQUE NOT NULL,
  sl_no BIGINT DEFAULT 0,
  customer_name TEXT,
  mobile_no TEXT,
  project_capacity DECIMAL(10,2) DEFAULT 0,
  total_quoted_cost DECIMAL(15,2) DEFAULT 0,
  
  application_charges DECIMAL(12,2) DEFAULT 0,
  modules_cost DECIMAL(12,2) DEFAULT 0,
  inverter_cost DECIMAL(12,2) DEFAULT 0,
  structure_cost DECIMAL(12,2) DEFAULT 0,
  hardware_cost DECIMAL(12,2) DEFAULT 0,
  electrical_equipment DECIMAL(12,2) DEFAULT 0,
  
  transport_segment DECIMAL(12,2) DEFAULT 0,
  transport_segments JSONB DEFAULT '[]'::jsonb,
  transport_total DECIMAL(12,2) DEFAULT 0,
  
  installation_cost DECIMAL(12,2) DEFAULT 0,
  subsidy_application DECIMAL(12,2) DEFAULT 0,
  misc_dept_charges DECIMAL(12,2) DEFAULT 0,
  
  dept_charges DECIMAL(12,2) DEFAULT 0,
  dept_charges_segments JSONB DEFAULT '[]'::jsonb,
  
  civil_work_cost DECIMAL(12,2) DEFAULT 0,
  civil_work_segments JSONB DEFAULT '[]'::jsonb,
  
  total_exp DECIMAL(15,2) DEFAULT 0,
  payment_received DECIMAL(15,2) DEFAULT 0,
  pending_payment DECIMAL(15,2) DEFAULT 0,
  profit_right_now DECIMAL(15,2) DEFAULT 0,
  overall_profit DECIMAL(15,2) DEFAULT 0,
  
  project_start_date TEXT,
  completion_date TEXT,
  payment_dates TEXT[] DEFAULT '{}'::TEXT[],
  
  state TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NO FOREIGN KEY CONSTRAINT - supports both projects and chitoor_projects
-- The application layer (checkProjectExists) validates the project exists

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================

DROP INDEX IF EXISTS ux_project_analysis_project_id;
CREATE UNIQUE INDEX ux_project_analysis_project_id
ON public.project_analysis(project_id)
WHERE project_id IS NOT NULL;

DROP INDEX IF EXISTS idx_project_analysis_state;
CREATE INDEX idx_project_analysis_state
ON public.project_analysis(state);

DROP INDEX IF EXISTS idx_project_analysis_updated_at;
CREATE INDEX idx_project_analysis_updated_at
ON public.project_analysis(updated_at DESC);

DROP INDEX IF EXISTS idx_project_analysis_customer_name;
CREATE INDEX idx_project_analysis_customer_name
ON public.project_analysis(customer_name);

DROP INDEX IF EXISTS idx_project_analysis_mobile_no;
CREATE INDEX idx_project_analysis_mobile_no
ON public.project_analysis(mobile_no);

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.project_analysis ENABLE ROW LEVEL SECURITY;

-- DROP existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.project_analysis;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.project_analysis;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.project_analysis;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.project_analysis;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users"
  ON public.project_analysis
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users"
  ON public.project_analysis
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users"
  ON public.project_analysis
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users"
  ON public.project_analysis
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================
-- 5. AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS trigger_update_project_analysis_timestamp ON public.project_analysis;
DROP FUNCTION IF EXISTS update_project_analysis_updated_at();

CREATE OR REPLACE FUNCTION update_project_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_analysis_timestamp
  BEFORE UPDATE ON public.project_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_project_analysis_updated_at();

-- ============================================
-- 6. AUTO-SYNC TRIGGER FOR NEW PROJECTS
-- ============================================

DROP TRIGGER IF EXISTS trigger_sync_new_projects_to_analysis ON public.projects;
DROP FUNCTION IF EXISTS sync_new_projects_to_analysis();

CREATE OR REPLACE FUNCTION sync_new_projects_to_analysis()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.project_analysis (
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

CREATE TRIGGER trigger_sync_new_projects_to_analysis
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_new_projects_to_analysis();

-- ============================================
-- 7. SYNC EXISTING PROJECTS TO PROJECT_ANALYSIS
-- ============================================

INSERT INTO public.project_analysis (
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
) SELECT
  p.id,
  ROW_NUMBER() OVER (ORDER BY p.created_at),
  p.customer_name,
  p.phone,
  p.kwh,
  p.proposal_amount,
  COALESCE(p.advance_payment, 0) + COALESCE(p.paid_amount, 0),
  COALESCE(p.balance_amount, 0),
  COALESCE(p.state, 'Other'),
  p.created_at,
  p.updated_at
FROM public.projects p
WHERE p.status != 'deleted'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_analysis pa WHERE pa.project_id = p.id
  )
ON CONFLICT (project_id) DO NOTHING;

-- Sync Chitoor projects as well
INSERT INTO public.project_analysis (
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
) SELECT
  cp.id,
  ROW_NUMBER() OVER (ORDER BY cp.created_at),
  cp.customer_name,
  cp.mobile_no,
  cp.capacity,
  cp.project_cost,
  cp.amount_received,
  cp.project_cost - cp.amount_received,
  'Chitoor',
  cp.created_at,
  cp.updated_at
FROM public.chitoor_projects cp
WHERE NOT EXISTS (
    SELECT 1 FROM public.project_analysis pa WHERE pa.project_id = cp.id
  )
ON CONFLICT (project_id) DO NOTHING;

-- ============================================
-- 8. VERIFICATION QUERIES
-- ============================================

-- Check if table was created
SELECT 'Table Created Successfully' as status 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'project_analysis';

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'project_analysis' 
ORDER BY indexname;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'project_analysis';

-- Count total records
SELECT COUNT(*) as total_records FROM public.project_analysis;

-- Show latest 10 records
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
