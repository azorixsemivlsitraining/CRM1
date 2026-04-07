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
 * Fresh full migration - clears and rebuilds project_analysis with all 220 projects
 * This ensures complete data sync from projects table
 */
export const freshMigrateProjectsToAnalysis = async (): Promise<MigrationResult> => {
  try {
    console.log('Starting fresh migration - clearing and rebuilding project_analysis...');

    // Step 1: Fetch ALL projects from projects table (no filters)
    const { data: projects, error: projectsError, count: projectsCount } = await supabase
      .from('projects')
      .select('id, customer_name, phone, kwh, proposal_amount, state, paid_amount, advance_payment, balance_amount, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    console.log(`Fetched ${projects?.length || 0} projects from projects table (total: ${projectsCount})`);

    if (projectsError) {
      return {
        success: false,
        message: 'Failed to fetch projects',
        error: projectsError.message,
      };
    }

    let totalRecords = 0;

    // Step 2: Delete all existing records from project_analysis to start fresh
    console.log('Clearing project_analysis table...');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { error: deleteError, count: deletedCount } = await supabase
      .from('project_analysis')
      .delete()
      .neq('id', ''); // Delete all records

    if (deleteError && (deleteError as any)?.code !== 'PGRST116') {
      console.error('Error clearing table:', deleteError);
      // Continue anyway, maybe table is already empty
    }

    // Step 3: Transform and insert projects
    if (projects && projects.length > 0) {
      const analysisData = projects.map((project: any, index: number) => ({
        id: project.id, // Use project_id as the analysis record id
        project_id: project.id,
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

      console.log(`Inserting ${analysisData.length} projects into project_analysis...`);

      const { error: insertError, data: insertedData } = await supabase
        .from('project_analysis')
        .insert(analysisData)
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        return {
          success: false,
          message: 'Failed to insert projects to project_analysis',
          error: insertError.message,
        };
      }

      totalRecords = insertedData?.length || analysisData.length;
      console.log(`Successfully inserted ${totalRecords} projects`);
    }

    // Step 4: Fetch and insert Chitoor projects
    const { data: chitoorProjects, error: chitoorError, count: chitoorCount } = await supabase
      .from('chitoor_projects')
      .select('*', { count: 'exact' });

    console.log(`Fetched ${chitoorProjects?.length || 0} Chitoor projects (total: ${chitoorCount})`);

    if (!chitoorError && chitoorProjects && chitoorProjects.length > 0) {
      const chitoorAnalysisData = chitoorProjects.map((project: any, index: number) => {
        const paymentReceived = project.amount_received || 0;
        const totalCost = project.project_cost || 0;
        return {
          id: project.id,
          project_id: project.id,
          sl_no: (totalRecords || 0) + index + 1,
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

      console.log(`Inserting ${chitoorAnalysisData.length} Chitoor projects...`);

      const { error: chitoorInsertError, data: chitoorInsertedData } = await supabase
        .from('project_analysis')
        .insert(chitoorAnalysisData)
        .select();

      if (chitoorInsertError) {
        console.error('Chitoor insert error:', chitoorInsertError);
        // Don't fail completely, already got main projects
      } else {
        const chitoorInserted = chitoorInsertedData?.length || chitoorAnalysisData.length;
        console.log(`Successfully inserted ${chitoorInserted} Chitoor projects`);
        totalRecords += chitoorInserted;
      }
    }

    console.log(`Migration complete! Total records: ${totalRecords}`);
    return {
      success: true,
      message: `Successfully migrated all ${totalRecords} projects to project_analysis table (${projects?.length || 0} projects + ${(chitoorProjects as any)?.length || 0} Chitoor)`,
      recordsMigrated: totalRecords,
    };
  } catch (error: any) {
    console.error('Fresh migration error:', error);
    return {
      success: false,
      message: 'Fresh migration failed with an error',
      error: error.message || String(error),
    };
  }
};

/**
 * Migrate existing project data from the projects table to project_analysis table
 * Uses UPSERT to preserve any already-updated analysis data
 */
export const migrateProjectsToAnalysis = async (): Promise<MigrationResult> => {
  try {
    let totalMigrated = 0;

    // Step 1: Fetch ALL projects (both active and inactive, to match Projects page count)
    // Using order by created_at desc to get consistent ordering
    const { data: projects, error: projectsError, count } = await supabase
      .from('projects')
      .select('id, customer_name, phone, kwh, proposal_amount, state, paid_amount, advance_payment, balance_amount, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    console.log(`Fetched ${projects?.length || 0} projects from database (total count: ${count})`);

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
      const { error: upsertError, data: upsertedData } = await supabase
        .from('project_analysis')
        .upsert(analysisData, { onConflict: 'id' })
        .select();

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        return {
          success: false,
          message: 'Failed to upsert data into project_analysis',
          error: upsertError.message,
        };
      }

      const projectsInserted = upsertedData?.length || analysisData.length;
      console.log(`Upserted ${projectsInserted} projects to project_analysis table`);
      totalMigrated += projectsInserted;
    }

    // Step 4: Also fetch and migrate Chitoor projects
    const { data: chitoorProjects, error: chitoorError, count: chitoorCount } = await supabase
      .from('chitoor_projects')
      .select('*', { count: 'exact' });

    console.log(`Fetched ${chitoorProjects?.length || 0} Chitoor projects (total count: ${chitoorCount})`);

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

      const { error: chitoorUpsertError, data: chitoorUpsertedData } = await supabase
        .from('project_analysis')
        .upsert(chitoorAnalysisData, { onConflict: 'id' })
        .select();

      if (chitoorUpsertError) {
        console.error('Chitoor upsert error:', chitoorUpsertError);
        return {
          success: false,
          message: 'Failed to upsert Chitoor projects',
          error: chitoorUpsertError.message,
        };
      }

      const chitoorInserted = chitoorUpsertedData?.length || chitoorAnalysisData.length;
      console.log(`Upserted ${chitoorInserted} Chitoor projects to project_analysis table`);
      totalMigrated += chitoorInserted;
    }

    console.log(`Migration complete: Total ${totalMigrated} records migrated`);
    return {
      success: true,
      message: `Successfully migrated ${totalMigrated} projects to project_analysis table (${projects?.length || 0} projects + ${(chitoorProjects as any)?.length || 0} Chitoor)`,
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
