-- Allow authenticated users to read only their own assignment rows
-- This is required for AuthContext to fetch module_access and region_access
-- for non-admin users like Yellesh.

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for assignees (self)" ON public.project_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.email = project_assignments.assignee_email
    )
    OR EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.role = 'admin'
    )
  );


