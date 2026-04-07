import { supabase } from '../lib/supabase';

interface MigrationResult {
  success: boolean;
  message: string;
  recordsMigrated?: number;
  error?: string;
}


const toNullableTimestamp = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Migrate existing project data from the projects table to project_analysis table
 * Uses UPSERT to preserve any already-updated analysis data
 */
export const migrateProjectsToAnalysis = async (): Promise<MigrationResult> => {
  try {
    let totalMigrated = 0;

    // Step 1: Fetch all projects that aren't deleted with all relevant fields
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, customer_name, phone, kwh, proposal_amount, state, paid_amount, advance_payment, balance_amount, created_at, updated_at')
      .neq('status', 'deleted');

    if (projectsError) {
      return {
        success: false,
        message: 'Failed to fetch projects',
        error: projectsError.message,
      };
    }

    if (projects && projects.length > 0) {
      // Step 2: Transform projects data to project_analysis format
      const analysisData = projects.map((project: any) => ({
        id: `analysis_${project.id}`,
        project_id: project.id,
        sl_no: 0,
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
        transport_segments: [],
        transport_total: 0,
        installation_cost: 0,
        subsidy_application: 0,
        misc_dept_charges: 0,
        dept_charges: 0,
        dept_charges_segments: [],
        civil_work_cost: 0,
        civil_work_segments: [],
        total_exp: 0,
        payment_received: (project.advance_payment || 0) + (project.paid_amount || 0),
        pending_payment: project.balance_amount || 0,
        profit_right_now: 0,
        overall_profit: 0,
        state: project.state || '',
        created_at: toNullableTimestamp(project.created_at),
        updated_at: toNullableTimestamp(project.updated_at),
      }));

      // Step 3: Upsert all records into project_analysis (preserves updated analysis data)
      const { error: upsertError } = await supabase
        .from('project_analysis')
        .upsert(analysisData, { onConflict: 'id' })
        .select();

      if (upsertError) {
        return {
          success: false,
          message: 'Failed to upsert data into project_analysis',
          error: upsertError.message,
        };
      }

      totalMigrated += analysisData.length;
    }

    // Step 4: Also fetch and migrate Chitoor projects
    const { data: chitoorProjects, error: chitoorError } = await supabase
      .from('chitoor_projects')
      .select('*');

    if (!chitoorError && chitoorProjects && chitoorProjects.length > 0) {
      const chitoorAnalysisData = chitoorProjects.map((project: any) => {
        const paymentReceived = project.amount_received || 0;
        const totalCost = project.project_cost || 0;
        return {
          id: `analysis_${project.id}`,
          project_id: project.id,
          sl_no: 0,
          customer_name: project.customer_name || '',
          mobile_no: project.mobile_no || '',
          project_capacity: project.capacity || 0,
          total_quoted_cost: totalCost,
          application_charges: 0,
          modules_cost: 0,
          inverter_cost: 0,
          structure_cost: 0,
          hardware_cost: 0,
          electrical_equipment: 0,
          transport_segment: 0,
          transport_segments: [],
          transport_total: 0,
          installation_cost: 0,
          subsidy_application: 0,
          misc_dept_charges: 0,
          dept_charges: 0,
          dept_charges_segments: [],
          civil_work_cost: 0,
          civil_work_segments: [],
          total_exp: 0,
          payment_received: paymentReceived,
          pending_payment: totalCost - paymentReceived,
          profit_right_now: 0,
          overall_profit: 0,
          state: 'Chitoor',
          created_at: toNullableTimestamp(project.created_at),
          updated_at: toNullableTimestamp(project.updated_at),
        };
      });

      const { error: chitoorUpsertError } = await supabase
        .from('project_analysis')
        .upsert(chitoorAnalysisData, { onConflict: 'id' })
        .select();

      if (chitoorUpsertError) {
        return {
          success: false,
          message: 'Failed to upsert Chitoor projects',
          error: chitoorUpsertError.message,
        };
      }

      totalMigrated += chitoorAnalysisData.length;
    }

    return {
      success: true,
      message: `Successfully migrated ${totalMigrated} projects to project_analysis table`,
      recordsMigrated: totalMigrated,
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
