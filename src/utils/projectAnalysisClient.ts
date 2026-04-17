import { supabase } from '../lib/supabase';

export interface ProjectAnalysisData {
  id: string;
  project_id: string;
  sl_no: number;
  customer_name: string;
  mobile_no: string;
  project_capacity: number;
  total_quoted_cost: number;
  application_charges: number;
  modules_cost: number;
  inverter_cost: number;
  structure_cost: number;
  hardware_cost: number;
  electrical_equipment: number;
  transport_segment: number;
  transport_segments: Array<{ label?: string; amount?: number }>;
  transport_total: number;
  installation_cost: number;
  subsidy_application: number;
  misc_dept_charges: number;
  dept_charges: number;
  dept_charges_segments: Array<{ label?: string; amount?: number }>;
  civil_work_cost: number;
  civil_work_segments: Array<{ label?: string; amount?: number }>;
  total_exp: number;
  payment_received: number;
  pending_payment: number;
  profit_right_now: number;
  overall_profit: number;
  project_start_date?: string;
  completion_date?: string;
  payment_dates?: string[];
  state?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Validate if a string is a valid UUID format
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Check if a project exists in either projects or chitoor_projects table
 */
export const checkProjectExists = async (projectId: string): Promise<{ exists: boolean; error?: string }> => {
  try {
    // Validate UUID format first
    const trimmedId = String(projectId || '').trim();
    if (!trimmedId) {
      return { exists: false, error: 'Project ID is empty' };
    }

    if (!isValidUUID(trimmedId)) {
      return { exists: false, error: `Invalid UUID format: ${trimmedId}` };
    }

    // Check in projects table
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', trimmedId)
      .maybeSingle();

    if (projectError) {
      console.warn('Error checking projects table:', projectError);
    }

    // If found in projects table, return success
    if (projectData) {
      return { exists: true };
    }

    // Check in chitoor_projects table as fallback
    const { data: chitoorData, error: chitoorError } = await supabase
      .from('chitoor_projects')
      .select('id')
      .eq('id', trimmedId)
      .maybeSingle();

    if (chitoorError) {
      console.warn('Error checking chitoor_projects table:', chitoorError);
    }

    const projectExists = Boolean(projectData || chitoorData);
    if (!projectExists) {
      console.warn(`Project not found in projects or chitoor_projects with ID: ${trimmedId}`);
    }
    return { exists: projectExists };
  } catch (err: any) {
    const errorMsg = err?.message || JSON.stringify(err);
    console.error('Error in checkProjectExists:', errorMsg);
    return { exists: false, error: errorMsg };
  }
};

/**
 * Fetch all project analysis records from Supabase
 */
export const fetchAllProjectAnalysis = async (
  stateFilter?: string
): Promise<{ data: ProjectAnalysisData[] | null; error: any }> => {
  try {
    let query = supabase
      .from('project_analysis')
      .select('*')
      .order('updated_at', { ascending: false });

    if (stateFilter && stateFilter !== 'All') {
      query = query.eq('state', stateFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching project analysis:', error);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (err) {
    console.error('Error in fetchAllProjectAnalysis:', err);
    return { data: null, error: err };
  }
};

/**
 * Fetch single project analysis by project_id
 */
export const fetchProjectAnalysis = async (
  projectId: string
): Promise<{ data: ProjectAnalysisData | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('project_analysis')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Record not found - this is expected for new projects
      return { data: null, error: null };
    }

    if (error) {
      console.error('Error fetching project analysis:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error in fetchProjectAnalysis:', err);
    return { data: null, error: err };
  }
};

/**
 * Update project analysis record
 */
export const updateProjectAnalysis = async (
  data: Partial<ProjectAnalysisData>
): Promise<{ data: ProjectAnalysisData | null; error: any }> => {
  try {
    if (!data.project_id) {
      return {
        data: null,
        error: { message: 'project_id is required' },
      };
    }

    const { data: result, error } = await supabase
      .from('project_analysis')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', data.project_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating project analysis:', error);
      return { data: null, error };
    }

    return { data: result as ProjectAnalysisData, error: null };
  } catch (err) {
    console.error('Error in updateProjectAnalysis:', err);
    return { data: null, error: err };
  }
};

/**
 * Upsert project analysis record (insert if not exists, update if exists)
 */
export const upsertProjectAnalysis = async (
  data: Partial<ProjectAnalysisData>
): Promise<{ data: ProjectAnalysisData | null; error: any }> => {
  try {
    const projectId = String(data.project_id || '').trim();

    if (!projectId) {
      return {
        data: null,
        error: { message: 'project_id is required' },
      };
    }

    // Validate UUID format
    if (!isValidUUID(projectId)) {
      return {
        data: null,
        error: { message: `Invalid project_id format: ${projectId}. Must be a valid UUID.` },
      };
    }

    const { data: result, error } = await supabase
      .from('project_analysis')
      .upsert(
        {
          ...data,
          project_id: projectId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id' }
      )
      .select()
      .single();

    if (error) {
      const errorMsg = error?.message || JSON.stringify(error);
      console.error('Error upserting project analysis:', errorMsg);
      return { data: null, error };
    }

    return { data: result as ProjectAnalysisData, error: null };
  } catch (err: any) {
    const errorMsg = err?.message || JSON.stringify(err);
    console.error('Error in upsertProjectAnalysis:', errorMsg);
    return { data: null, error: err };
  }
};

/**
 * Delete project analysis record
 */
export const deleteProjectAnalysis = async (
  projectId: string
): Promise<{ success: boolean; error: any }> => {
  try {
    const { error } = await supabase
      .from('project_analysis')
      .delete()
      .eq('project_id', projectId);

    if (error) {
      console.error('Error deleting project analysis:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in deleteProjectAnalysis:', err);
    return { success: false, error: err };
  }
};

/**
 * Calculate total expenses
 */
export const calculateTotalExpenses = (data: Partial<ProjectAnalysisData>): number => {
  return (
    (data.application_charges || 0) +
    (data.modules_cost || 0) +
    (data.inverter_cost || 0) +
    (data.structure_cost || 0) +
    (data.hardware_cost || 0) +
    (data.electrical_equipment || 0) +
    (data.transport_segment || 0) +
    (data.installation_cost || 0) +
    (data.subsidy_application || 0) +
    (data.misc_dept_charges || 0) +
    (data.dept_charges || 0) +
    (data.civil_work_cost || 0)
  );
};

/**
 * Calculate profit right now (payment received - total expenses)
 */
export const calculateProfitRightNow = (data: Partial<ProjectAnalysisData>): number => {
  const totalExp = calculateTotalExpenses(data);
  return (data.payment_received || 0) - totalExp;
};

/**
 * Calculate overall profit (quoted cost - total expenses)
 */
export const calculateOverallProfit = (data: Partial<ProjectAnalysisData>): number => {
  const totalExp = calculateTotalExpenses(data);
  return (data.total_quoted_cost || 0) - totalExp;
};

/**
 * Sum amount from segments array
 */
export const sumSegmentAmount = (segments: Array<{ label?: string; amount?: number }>): number => {
  if (!Array.isArray(segments)) return 0;
  return segments.reduce((sum, seg) => sum + (Number(seg.amount) || 0), 0);
};

/**
 * Subscribe to real-time updates for project analysis
 */
export const subscribeToProjectAnalysis = (
  callback: (payload: any) => void
): (() => void) => {
  const channel = supabase
    .channel('project-analysis-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_analysis',
      },
      (payload: any) => {
        console.log('Project analysis updated:', payload);
        callback(payload);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Prepare data for save with auto-calculations
 */
export const prepareProjectAnalysisForSave = (
  data: Partial<ProjectAnalysisData>
): Partial<ProjectAnalysisData> => {
  const totalExp = calculateTotalExpenses(data);
  const profitRightNow = calculateProfitRightNow(data);
  const overallProfit = calculateOverallProfit(data);

  return {
    ...data,
    total_exp: totalExp,
    profit_right_now: profitRightNow,
    overall_profit: overallProfit,
    updated_at: new Date().toISOString(),
  };
};

/**
 * Find and remove orphaned project analysis records
 * (records with project_ids that no longer exist in projects or chitoor_projects tables)
 */
export const cleanupOrphanedProjectAnalysis = async (): Promise<{
  deleted: number;
  error?: string;
}> => {
  try {
    // Fetch all project_analysis records
    const { data: analysisRecords, error: analysisError } = await supabase
      .from('project_analysis')
      .select('project_id');

    if (analysisError) {
      return { deleted: 0, error: analysisError.message };
    }

    // Fetch all valid project IDs from both tables
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id');

    const { data: chitoorProjects, error: chitoorError } = await supabase
      .from('chitoor_projects')
      .select('id');

    if (projectError) {
      return { deleted: 0, error: projectError.message };
    }

    if (chitoorError) {
      console.warn('Warning: Could not fetch Chitoor projects:', chitoorError);
    }

    // Build set of valid project IDs
    const validProjectIds = new Set<string>();
    (projects || []).forEach((p: any) => validProjectIds.add(String(p.id)));
    (chitoorProjects || []).forEach((p: any) => validProjectIds.add(String(p.id)));

    // Find orphaned records
    const orphanedIds = (analysisRecords || [])
      .map((r: any) => String(r.project_id || '').trim())
      .filter((id: string) => id && !validProjectIds.has(id));

    // Remove duplicates
    const uniqueOrphanedIds = Array.from(new Set(orphanedIds));

    if (uniqueOrphanedIds.length === 0) {
      return { deleted: 0 };
    }

    // Delete orphaned records in batches
    let deletedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < uniqueOrphanedIds.length; i += batchSize) {
      const batch = uniqueOrphanedIds.slice(i, i + batchSize);
      const { error: deleteError, count } = await supabase
        .from('project_analysis')
        .delete()
        .in('project_id', batch);

      if (deleteError) {
        console.error('Error deleting orphaned records:', deleteError);
        return { deleted: deletedCount, error: deleteError.message };
      }

      deletedCount += count || 0;
    }

    console.log(`Successfully deleted ${deletedCount} orphaned project analysis records`);
    return { deleted: deletedCount };
  } catch (error: any) {
    const errorMsg = error?.message || JSON.stringify(error);
    console.error('Error in cleanupOrphanedProjectAnalysis:', errorMsg);
    return { deleted: 0, error: errorMsg };
  }
};
