import { supabase } from '../lib/supabase';

interface MigrationResult {
  success: boolean;
  message: string;
  recordsMigrated?: number;
  error?: string;
}

const PAGE_SIZE = 500;

async function fetchAllRows<T>(
  baseQuery: any,
  pageSize: number = PAGE_SIZE
): Promise<{ data: T[]; error: any | null; count?: number | null }> {
  const out: T[] = [];
  let from = 0;
  let totalCount: number | null | undefined = undefined;
  for (;;) {
    const res = await baseQuery.range(from, from + pageSize - 1);
    const { data, error, count } = res || {};
    if (typeof totalCount === 'undefined') totalCount = typeof count === 'number' ? count : null;
    if (error) return { data: out, error, count: totalCount };
    const rows = Array.isArray(data) ? (data as T[]) : [];
    out.push(...rows);
    if (rows.length < pageSize) return { data: out, error: null, count: totalCount };
    from += pageSize;
    if (from > 50000) return { data: out, error: new Error('Pagination exceeded safety limit'), count: totalCount };
  }
}

function stripMissingColumnFromRows(rows: any[], columnName: string) {
  return rows.map((r) => {
    const next = { ...r };
    delete (next as any)[columnName];
    return next;
  });
}

function extractMissingColumnName(err: any): string | null {
  const msg = String(err?.message || err?.details || err || '');
  // PostgREST typical message: `Could not find the 'dept_charges_segments' column of 'project_analysis'...`
  const m1 = msg.match(/'([a-zA-Z0-9_]+)'\s+column/i);
  if (m1?.[1]) return m1[1];
  // Postgres style: column "dept_charges_segments" does not exist
  const m2 = msg.match(/column\s+"([a-zA-Z0-9_]+)"\s+does not exist/i);
  if (m2?.[1]) return m2[1];
  return null;
}

async function upsertInBatchesWithCompat(
  table: string,
  rows: any[],
  onConflict: string,
  batchSize: number = 100
): Promise<{ error: any | null; rowsAffected: number }> {
  let payload = rows;
  let stripped: Set<string> = new Set();
  let total = 0;

  for (;;) {
    total = 0;
    let lastErr: any | null = null;

    for (let i = 0; i < payload.length; i += batchSize) {
      const batch = payload.slice(i, i + batchSize);
      const { error, data } = await supabase.from(table).upsert(batch, { onConflict }).select();
      if (error) {
        lastErr = error;
        break;
      }
      total += Array.isArray(data) ? data.length : batch.length;
    }

    if (!lastErr) return { error: null, rowsAffected: total };

    const missing = extractMissingColumnName(lastErr);
    if (!missing || stripped.has(missing)) return { error: lastErr, rowsAffected: total };

    console.warn(`Upsert failed due to missing column "${missing}". Retrying without it...`);
    stripped.add(missing);
    payload = stripMissingColumnFromRows(payload, missing);
  }
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

    // Step 0: Fetch existing project_analysis records to preserve manually-entered cost data
    const { data: existingAnalysis, error: existingError } = await fetchAllRows<any>(
      supabase
        .from('project_analysis')
        .select('id, project_id, application_charges, modules_cost, inverter_cost, structure_cost, hardware_cost, electrical_equipment, transport_segment, transport_segments, transport_total, installation_cost, subsidy_application, misc_dept_charges, dept_charges, dept_charges_segments, civil_work_cost, civil_work_segments, total_exp, profit_right_now, overall_profit')
    );

    const existingByProjectId = new Map<string, any>();
    if (!existingError && Array.isArray(existingAnalysis)) {
      existingAnalysis.forEach((rec: any) => {
        const key = String(rec.project_id || rec.id || '');
        if (key) existingByProjectId.set(key, rec);
      });
    }
    console.log(`Fetched ${existingByProjectId.size} existing project_analysis records to preserve cost data`);

    // Step 1: Fetch ALL projects from projects table (no filters)
    const { data: projects, error: projectsError, count: projectsCount } = await fetchAllRows<any>(
      supabase
        .from('projects')
        .select(
          'id, customer_name, phone, kwh, proposal_amount, state, paid_amount, advance_payment, balance_amount, created_at, updated_at',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
    );

    console.log(`Fetched ${projects?.length || 0} projects from projects table (total: ${projectsCount})`);

    if (projectsError) {
      return {
        success: false,
        message: 'Failed to fetch projects',
        error: projectsError.message,
      };
    }

    let totalRecords = 0;

    // Step 2: Do NOT hard-clear first. Use upsert so migration is resilient
    // even when delete policies are restricted.
    console.log('Upserting into project_analysis without hard delete...');

    // Step 3: Transform and insert projects, preserving manually-entered cost data
    if (projects && projects.length > 0) {
      const analysisData = projects.map((project: any, index: number) => {
        const projectId = String(project.id);
        const existing = existingByProjectId.get(projectId);

        // Preserve cost fields from existing record if they were manually entered (non-zero)
        return {
          id: project.id,
          project_id: project.id,
          sl_no: index + 1,
          customer_name: project.customer_name || '',
          mobile_no: project.phone || '',
          project_capacity: project.kwh || 0,
          total_quoted_cost: project.proposal_amount || 0,
          application_charges: existing?.application_charges ?? 0,
          modules_cost: existing?.modules_cost ?? 0,
          inverter_cost: existing?.inverter_cost ?? 0,
          structure_cost: existing?.structure_cost ?? 0,
          hardware_cost: existing?.hardware_cost ?? 0,
          electrical_equipment: existing?.electrical_equipment ?? 0,
          transport_segment: existing?.transport_segment ?? 0,
          transport_segments: existing?.transport_segments ?? [],
          transport_total: existing?.transport_total ?? 0,
          installation_cost: existing?.installation_cost ?? 0,
          subsidy_application: existing?.subsidy_application ?? 0,
          misc_dept_charges: existing?.misc_dept_charges ?? 0,
          dept_charges: existing?.dept_charges ?? 0,
          dept_charges_segments: existing?.dept_charges_segments ?? [],
          civil_work_cost: existing?.civil_work_cost ?? 0,
          civil_work_segments: existing?.civil_work_segments ?? [],
          total_exp: existing?.total_exp ?? 0,
          payment_received: (project.advance_payment || 0) + (project.paid_amount || 0),
          pending_payment: project.balance_amount || 0,
          profit_right_now: existing?.profit_right_now ?? 0,
          overall_profit: existing?.overall_profit ?? 0,
          state: project.state || '',
          created_at: toNullableTimestamp(project.created_at),
          updated_at: toNullableTimestamp(project.updated_at),
        };
      });

      console.log(`Upserting ${analysisData.length} projects into project_analysis...`);

      const { error: insertError, rowsAffected } = await upsertInBatchesWithCompat(
        'project_analysis',
        analysisData,
        'id',
        100
      );

      if (insertError) {
        console.error('Insert error:', insertError);
        return {
          success: false,
          message: 'Failed to upsert projects to project_analysis',
          error: insertError.message,
        };
      }

      totalRecords = rowsAffected;
      console.log(`Successfully inserted ${totalRecords} projects`);
    }

    // Step 4: Fetch and insert Chitoor projects
    const { data: chitoorProjects, error: chitoorError, count: chitoorCount } = await fetchAllRows<any>(
      supabase.from('chitoor_projects').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    );

    console.log(`Fetched ${chitoorProjects?.length || 0} Chitoor projects (total: ${chitoorCount})`);

    if (!chitoorError && chitoorProjects && chitoorProjects.length > 0) {
      const chitoorAnalysisData = chitoorProjects.map((project: any, index: number) => {
        const projectId = String(project.id);
        const existing = existingByProjectId.get(projectId);
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
          application_charges: existing?.application_charges ?? 0,
          modules_cost: existing?.modules_cost ?? 0,
          inverter_cost: existing?.inverter_cost ?? 0,
          structure_cost: existing?.structure_cost ?? 0,
          hardware_cost: existing?.hardware_cost ?? 0,
          electrical_equipment: existing?.electrical_equipment ?? 0,
          transport_segment: existing?.transport_segment ?? 0,
          transport_segments: existing?.transport_segments ?? [],
          transport_total: existing?.transport_total ?? 0,
          installation_cost: existing?.installation_cost ?? 0,
          subsidy_application: existing?.subsidy_application ?? 0,
          misc_dept_charges: existing?.misc_dept_charges ?? 0,
          dept_charges: existing?.dept_charges ?? 0,
          dept_charges_segments: existing?.dept_charges_segments ?? [],
          civil_work_cost: existing?.civil_work_cost ?? 0,
          civil_work_segments: existing?.civil_work_segments ?? [],
          total_exp: existing?.total_exp ?? 0,
          payment_received: paymentReceived,
          pending_payment: totalCost - paymentReceived,
          profit_right_now: existing?.profit_right_now ?? 0,
          overall_profit: existing?.overall_profit ?? 0,
          state: 'Chitoor',
          created_at: toNullableTimestamp(project.created_at),
          updated_at: toNullableTimestamp(project.updated_at),
        };
      });

      console.log(`Upserting ${chitoorAnalysisData.length} Chitoor projects...`);

      const { error: chitoorInsertError, rowsAffected: chitoorInserted } = await upsertInBatchesWithCompat(
        'project_analysis',
        chitoorAnalysisData,
        'id',
        100
      );
      if (chitoorInsertError) {
        console.error('Chitoor insert error:', chitoorInsertError);
      } else if (chitoorInserted > 0) {
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

    // Step 0: Fetch existing project_analysis records to preserve manually-entered cost data
    const { data: existingAnalysis, error: existingError } = await fetchAllRows<any>(
      supabase
        .from('project_analysis')
        .select('id, project_id, application_charges, modules_cost, inverter_cost, structure_cost, hardware_cost, electrical_equipment, transport_segment, transport_segments, transport_total, installation_cost, subsidy_application, misc_dept_charges, dept_charges, dept_charges_segments, civil_work_cost, civil_work_segments, total_exp, profit_right_now, overall_profit')
    );

    const existingByProjectId = new Map<string, any>();
    if (!existingError && Array.isArray(existingAnalysis)) {
      existingAnalysis.forEach((rec: any) => {
        const key = String(rec.project_id || rec.id || '');
        if (key) existingByProjectId.set(key, rec);
      });
    }
    console.log(`Fetched ${existingByProjectId.size} existing project_analysis records to preserve cost data`);

    // Step 1: Fetch ALL projects (both active and inactive, to match Projects page count)
    // Using order by created_at desc to get consistent ordering
    const { data: projects, error: projectsError, count } = await fetchAllRows<any>(
      supabase
        .from('projects')
        .select(
          'id, customer_name, phone, kwh, proposal_amount, state, paid_amount, advance_payment, balance_amount, created_at, updated_at',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
    );

    console.log(`Fetched ${projects?.length || 0} projects from database (total count: ${count})`);

    if (projectsError) {
      return {
        success: false,
        message: 'Failed to fetch projects',
        error: projectsError.message,
      };
    }

    if (projects && projects.length > 0) {
      // Step 2: Transform projects data to project_analysis format, preserving manually-entered cost data
      const analysisData = projects.map((project: any) => {
        const projectId = String(project.id);
        const existing = existingByProjectId.get(projectId);
        return {
          id: project.id,
          project_id: project.id,
          sl_no: 0,
          customer_name: project.customer_name || '',
          mobile_no: project.phone || '',
          project_capacity: project.kwh || 0,
          total_quoted_cost: project.proposal_amount || 0,
          application_charges: existing?.application_charges ?? 0,
          modules_cost: existing?.modules_cost ?? 0,
          inverter_cost: existing?.inverter_cost ?? 0,
          structure_cost: existing?.structure_cost ?? 0,
          hardware_cost: existing?.hardware_cost ?? 0,
          electrical_equipment: existing?.electrical_equipment ?? 0,
          transport_segment: existing?.transport_segment ?? 0,
          transport_segments: existing?.transport_segments ?? [],
          transport_total: existing?.transport_total ?? 0,
          installation_cost: existing?.installation_cost ?? 0,
          subsidy_application: existing?.subsidy_application ?? 0,
          misc_dept_charges: existing?.misc_dept_charges ?? 0,
          dept_charges: existing?.dept_charges ?? 0,
          dept_charges_segments: existing?.dept_charges_segments ?? [],
          civil_work_cost: existing?.civil_work_cost ?? 0,
          civil_work_segments: existing?.civil_work_segments ?? [],
          total_exp: existing?.total_exp ?? 0,
          payment_received: (project.advance_payment || 0) + (project.paid_amount || 0),
          pending_payment: project.balance_amount || 0,
          profit_right_now: existing?.profit_right_now ?? 0,
          overall_profit: existing?.overall_profit ?? 0,
          state: project.state || '',
          created_at: toNullableTimestamp(project.created_at),
          updated_at: toNullableTimestamp(project.updated_at),
        };
      });

      // Step 3: Upsert all records into project_analysis (preserves updated analysis data)
      const { error: upsertError, rowsAffected } = await upsertInBatchesWithCompat(
        'project_analysis',
        analysisData,
        'id',
        100
      );

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        return {
          success: false,
          message: 'Failed to upsert data into project_analysis',
          error: upsertError.message,
        };
      }

      const projectsInserted = rowsAffected || analysisData.length;
      console.log(`Upserted ${projectsInserted} projects to project_analysis table`);
      totalMigrated += projectsInserted;
    }

    // Step 4: Also fetch and migrate Chitoor projects
    const { data: chitoorProjects, error: chitoorError, count: chitoorCount } = await fetchAllRows<any>(
      supabase.from('chitoor_projects').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    );

    console.log(`Fetched ${chitoorProjects?.length || 0} Chitoor projects (total count: ${chitoorCount})`);

    if (!chitoorError && chitoorProjects && chitoorProjects.length > 0) {
      const chitoorAnalysisData = chitoorProjects.map((project: any) => {
        const projectId = String(project.id);
        const existing = existingByProjectId.get(projectId);
        const paymentReceived = project.amount_received || 0;
        const totalCost = project.project_cost || 0;
        return {
          id: project.id,
          project_id: project.id,
          sl_no: 0,
          customer_name: project.customer_name || '',
          mobile_no: project.mobile_no || '',
          project_capacity: project.capacity || 0,
          total_quoted_cost: totalCost,
          application_charges: existing?.application_charges ?? 0,
          modules_cost: existing?.modules_cost ?? 0,
          inverter_cost: existing?.inverter_cost ?? 0,
          structure_cost: existing?.structure_cost ?? 0,
          hardware_cost: existing?.hardware_cost ?? 0,
          electrical_equipment: existing?.electrical_equipment ?? 0,
          transport_segment: existing?.transport_segment ?? 0,
          transport_segments: existing?.transport_segments ?? [],
          transport_total: existing?.transport_total ?? 0,
          installation_cost: existing?.installation_cost ?? 0,
          subsidy_application: existing?.subsidy_application ?? 0,
          misc_dept_charges: existing?.misc_dept_charges ?? 0,
          dept_charges: existing?.dept_charges ?? 0,
          dept_charges_segments: existing?.dept_charges_segments ?? [],
          civil_work_cost: existing?.civil_work_cost ?? 0,
          civil_work_segments: existing?.civil_work_segments ?? [],
          total_exp: existing?.total_exp ?? 0,
          payment_received: paymentReceived,
          pending_payment: totalCost - paymentReceived,
          profit_right_now: existing?.profit_right_now ?? 0,
          overall_profit: existing?.overall_profit ?? 0,
          state: 'Chitoor',
          created_at: toNullableTimestamp(project.created_at),
          updated_at: toNullableTimestamp(project.updated_at),
        };
      });

      const { error: chitoorUpsertError, rowsAffected } = await upsertInBatchesWithCompat(
        'project_analysis',
        chitoorAnalysisData,
        'id',
        100
      );

      if (chitoorUpsertError) {
        console.error('Chitoor upsert error:', chitoorUpsertError);
        return {
          success: false,
          message: 'Failed to upsert Chitoor projects',
          error: chitoorUpsertError.message,
        };
      }

      const chitoorInserted = rowsAffected || chitoorAnalysisData.length;
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
 * Ensure regular `projects` table rows exist in `project_analysis`.
 * Safe to call frequently: uses upsert on `id`.
 */
export const syncProjectsSnapshotToAnalysis = async (projects: Array<any>): Promise<MigrationResult> => {
  try {
    if (!Array.isArray(projects) || projects.length === 0) {
      return { success: true, message: 'No projects to sync', recordsMigrated: 0 };
    }

    const analysisData = projects.map((project: any) => ({
      id: project.id,
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

    const { error, rowsAffected } = await upsertInBatchesWithCompat('project_analysis', analysisData, 'id', 100);
    if (error) {
      return {
        success: false,
        message: 'Failed syncing projects snapshot to analysis',
        error: error.message || String(error),
      };
    }

    return {
      success: true,
      message: `Synced ${rowsAffected} projects into project_analysis`,
      recordsMigrated: rowsAffected,
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Projects snapshot sync failed',
      error: error?.message || String(error),
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
