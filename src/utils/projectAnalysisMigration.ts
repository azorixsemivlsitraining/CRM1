import { supabase } from '../lib/supabase';

interface MigrationResult {
  success: boolean;
  message: string;
  recordsMigrated?: number;
  error?: string;
}

interface ProjectRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  kwh: number | null;
  proposal_amount: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Migrate existing project data from the projects table to project_analysis table
 */
export const migrateProjectsToAnalysis = async (): Promise<MigrationResult> => {
  try {
    // Step 1: Fetch all projects that aren't deleted
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, customer_name, phone, kwh, proposal_amount, created_at, updated_at')
      .neq('status', 'deleted');

    if (projectsError) {
      return {
        success: false,
        message: 'Failed to fetch projects',
        error: projectsError.message,
      };
    }

    if (!projects || projects.length === 0) {
      return {
        success: true,
        message: 'No projects to migrate',
        recordsMigrated: 0,
      };
    }

    // Step 2: Transform projects data to project_analysis format
    const analysisData = projects.map((project: ProjectRow, index: number) => ({
      sl_no: index + 1,
      customer_name: project.customer_name || '',
      mobile_no: project.phone || '',
      project_capacity: project.kwh || 0,
      total_quoted_cost: project.proposal_amount || 0,
      application_charges: 0,
      modules_cost: 0,
      inverter_cost: 0,
      structure_cost: 0,
      hardware_cost: 0,
      electrical_equipment: 0,
      transport_segment: 0,
      transport_total: 0,
      installation_cost: 0,
      subsidy_application: 0,
      misc_dept_charges: 0,
      dept_charges: 0,
      total_exp: 0,
      payment_received: 0,
      pending_payment: 0,
      profit_right_now: 0,
      overall_profit: 0,
      project_id: project.id,
      created_at: project.created_at,
      updated_at: project.updated_at,
    }));

    // Step 3: Insert all records into project_analysis
    const { error: insertError } = await supabase
      .from('project_analysis')
      .insert(analysisData)
      .select();

    if (insertError) {
      return {
        success: false,
        message: 'Failed to insert data into project_analysis',
        error: insertError.message,
      };
    }

    return {
      success: true,
      message: `Successfully migrated ${analysisData.length} projects to project_analysis table`,
      recordsMigrated: analysisData.length,
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Migration failed with an error',
      error: error.message || String(error),
    };
  }
};

/**
 * Clear all data from project_analysis table (useful for re-migration)
 */
export const clearProjectAnalysisData = async (): Promise<MigrationResult> => {
  try {
    const { error } = await supabase
      .from('project_analysis')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      return {
        success: false,
        message: 'Failed to clear project_analysis data',
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Successfully cleared project_analysis table',
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Clear operation failed',
      error: error.message || String(error),
    };
  }
};

/**
 * Check if project_analysis table is empty
 */
export const checkProjectAnalysisEmpty = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('project_analysis')
      .select('id', { count: 'exact' })
      .limit(1);

    if (error) {
      console.error('Error checking project_analysis:', error);
      return true;
    }

    return !data || data.length === 0;
  } catch (error) {
    console.error('Error in checkProjectAnalysisEmpty:', error);
    return true;
  }
};
