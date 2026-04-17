import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardHeader,
  CardBody,
  SimpleGrid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Input,
  InputGroup,
  InputLeftElement,
  Button,
  IconButton,
  Progress,
  Flex,
  useColorModeValue,
  Stat,
  StatLabel,
  StatNumber,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  FormControl,
  FormLabel,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
} from '@chakra-ui/react';
import { DeleteIcon, SearchIcon, DownloadIcon, RepeatIcon } from '@chakra-ui/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { migrateProjectsToAnalysis, freshMigrateProjectsToAnalysis, checkProjectAnalysisEmpty } from '../utils/projectAnalysisMigration';
import {
  fetchAllProjectAnalysis,
  updateProjectAnalysis,
  upsertProjectAnalysis,
  deleteProjectAnalysis,
  subscribeToProjectAnalysis,
  prepareProjectAnalysisForSave,
  checkProjectExists,
  ProjectAnalysisData,
} from '../utils/projectAnalysisClient';
import ProjectAnalysisModal from '../components/ProjectAnalysisModal';

interface ProjectData {
  id: string;
  sl_no: number;
  customer_name: string;
  mobile_no: string;
  project_capacity: number;
  total_quoted_cost: number;
  application_charges?: number;
  modules_cost?: number;
  inverter_cost?: number;
  structure_cost?: number;
  hardware_cost?: number;
  electrical_equipment?: number;
  transport_segment?: number;
  /**
   * Breakdown of transportation items/heads stored in DB as JSONB.
   * Structure:
   * [
   *   { "label": "ETTX", "amount": 1000 },
   *   { "label": "DD element", "amount": 500 }
   * ]
   */
  transport_segments?: Array<{ label?: string; amount?: number }>;
  transport_total?: number;
  installation_cost?: number;
  subsidy_application?: number;
  misc_dept_charges?: number;
  dept_charges?: number;
  /**
   * Breakdown of department charges items/heads stored in DB as JSONB.
   * Same structure as transport segments: [{ label, amount }]
   */
  dept_charges_segments?: Array<{ label?: string; amount?: number }>;
  civil_work_cost?: number;
  /**
   * Breakdown of civil work items/heads stored in DB as JSONB.
   * Same structure as transport segments: [{ label, amount }]
   */
  civil_work_segments?: Array<{ label?: string; amount?: number }>;
  total_exp?: number;
  payment_received?: number;
  pending_payment?: number;
  profit_right_now?: number;
  overall_profit?: number;
  project_id?: string;
  project_start_date?: string;
  completion_date?: string;
  payment_dates?: string[];
  created_at?: string;
  updated_at?: string;
  state?: string;
}

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const toNullableTimestamp = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

/** JSONB segment columns sometimes arrive as stringified JSON from PostgREST — normalize for merge + forms. */
const coerceSegmentArray = (value: unknown): Array<{ label?: string; amount?: number }> => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value as Array<{ label?: string; amount?: number }>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeDbProjectAnalysisRow = (r: Record<string, unknown>): ProjectData => {
  const row = { ...r } as Record<string, unknown>;
  row.transport_segments = coerceSegmentArray(row.transport_segments);
  row.dept_charges_segments = coerceSegmentArray(row.dept_charges_segments);
  row.civil_work_segments = coerceSegmentArray(row.civil_work_segments);
  return row as unknown as ProjectData;
};

const extractMissingColumnName = (err: unknown): string | null => {
  const msg = String((err as any)?.message || (err as any)?.details || err || '');
  const m1 = msg.match(/'([a-zA-Z0-9_]+)'\s+column/i);
  if (m1?.[1]) return m1[1];
  const m2 = msg.match(/column\s+"([a-zA-Z0-9_]+)"\s+does not exist/i);
  if (m2?.[1]) return m2[1];
  return null;
};

const getProjectBucket = (project: ProjectData): 'TG' | 'AP' | 'Chitoor' | 'Other' => {
  const s = normalizeText(project.state);

  // Chitoor is treated as its own category (even if it is AP district)
  if (s === 'chitoor' || s === 'chittoor' || s.includes('chitoor') || s.includes('chittoor')) return 'Chitoor';

  // Telangana
  if (s === 'tg' || s === 'ts' || s.includes('telangana')) return 'TG';

  // Andhra Pradesh
  if (s === 'ap' || s.includes('andhra pradesh') || s.includes('andhra') || s.includes('a.p')) return 'AP';

  return 'Other';
};

const calculateTotalExpenses = (project: ProjectData): number => {
  return (
    (project.application_charges || 0) +
    (project.modules_cost || 0) +
    (project.inverter_cost || 0) +
    (project.structure_cost || 0) +
    (project.hardware_cost || 0) +
    (project.electrical_equipment || 0) +
    (project.transport_segment || 0) +
    (project.transport_total || 0) +
    (project.installation_cost || 0) +
    (project.subsidy_application || 0) +
    (project.misc_dept_charges || 0) +
    (project.dept_charges || 0) +
    (project.civil_work_cost || 0)
  );
};

const calculateProfitRightNow = (project: ProjectData): number => {
  const totalExp = calculateTotalExpenses(project);
  return (project.payment_received || 0) - totalExp;
};

const calculateOverallProfit = (project: ProjectData): number => {
  const totalExp = calculateTotalExpenses(project);
  return (project.total_quoted_cost || 0) - totalExp;
};

const normalizeTransportSegments = (segments: unknown): Array<{ label: string; amount: number }> => {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((s: any) => {
      const label = String(s?.label ?? s?.name ?? s?.text ?? '').trim();
      const amount =
        typeof s?.amount === 'number' ? s.amount : parseFloat(String(s?.amount ?? 0)) || 0;
      return { label, amount };
    })
};

const sumTransportSegments = (segments: unknown): number => {
  return normalizeTransportSegments(segments).reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
};

const PAGE_SIZE = 500;

async function fetchAllRows<T>(
  baseQuery: any,
  pageSize: number = PAGE_SIZE
): Promise<{ data: T[]; error: any | null }> {
  const out: T[] = [];
  let from = 0;
  // Keep paging until a page returns less than pageSize rows.
  // This also works even if the API has a low max-rows cap (e.g. 1),
  // because we increment the offset and keep requesting.
  for (;;) {
    const { data, error } = await baseQuery.range(from, from + pageSize - 1);
    if (error) return { data: out, error };
    const rows = Array.isArray(data) ? (data as T[]) : [];
    out.push(...rows);
    if (rows.length < pageSize) return { data: out, error: null };
    from += pageSize;
    // Safety valve: avoid infinite loops if server keeps returning full pages forever.
    if (from > 50000) return { data: out, error: new Error('Pagination exceeded safety limit') };
  }
}

/**
 * Sync new projects from source tables to project_analysis table
 * This ensures all projects have analysis records and new data is captured
 */
const syncNewProjectsToAnalysis = async (toast: any): Promise<void> => {
  try {
    // Fetch all non-deleted projects from projects table
    const { data: projects, error: projectError } = await fetchAllRows<any>(
      supabase
        .from('projects')
        .select(
          'id, customer_name, phone, kwh, proposal_amount, state, paid_amount, advance_payment, balance_amount, created_at, updated_at'
        )
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
    );

    if (projectError) {
      console.error('Error fetching projects for sync:', projectError);
      return;
    }

    if (!projects || projects.length === 0) return;

    // Fetch existing analysis records to find which projects already have analysis
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: existingAnalysis, error: analysisError } = await fetchAllRows<any>(
      supabase.from('project_analysis').select('project_id')
    );

    const existingProjectIds = new Set(
      (existingAnalysis || [])
        .map((a: any) => a.project_id)
        .filter((id: any) => id)
    );

    // Find new projects that don't have analysis records yet
    const newProjectsToAdd = projects.filter((p: any) => !existingProjectIds.has(p.id));

    if (newProjectsToAdd.length === 0) return;

    // Create analysis records for new projects
    const newAnalysisRecords = newProjectsToAdd.map((project: any) => ({
      // Keep analysis record id as UUID (same as project id) for compatibility with DB schema.
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
      created_at: project.created_at,
      updated_at: project.updated_at,
    }));

    // Also sync Chitoor projects
    const { data: chitoorProjects, error: chitoorError } = await fetchAllRows<any>(
      supabase.from('chitoor_projects').select('*').order('created_at', { ascending: false })
    );

    if (!chitoorError && chitoorProjects && chitoorProjects.length > 0) {
      const existingChitoorAnalysis = new Set(
        (existingAnalysis || [])
          .filter((a: any) => a.project_id && a.project_id.includes('chitoor'))
          .map((a: any) => a.project_id)
      );

      const newChitoorProjects = chitoorProjects.filter((p: any) => !existingChitoorAnalysis.has(p.id));

      const chitoorAnalysisRecords = newChitoorProjects.map((project: any) => {
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
          created_at: project.created_at,
          updated_at: project.updated_at,
        };
      });

      newAnalysisRecords.push(...chitoorAnalysisRecords);
    }

    if (newAnalysisRecords.length > 0) {
      // Insert in batches to avoid request-size limits.
      const batchSize = 100;
      for (let i = 0; i < newAnalysisRecords.length; i += batchSize) {
        const batch = newAnalysisRecords.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from('project_analysis').insert(batch);

        if (insertError) {
          console.error('Error syncing new projects (batch):', insertError);
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error in syncNewProjectsToAnalysis:', error);
  }
};

const ProjectAnalysis = () => {
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const [projectData, setProjectData] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const [isAnalysisUnlocked, setIsAnalysisUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [filteredData, setFilteredData] = useState<ProjectData[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'TG' | 'AP' | 'Chitoor'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const raw = normalizeText(params.state);
    if (!raw) {
      setSelectedFilter('All');
      return;
    }
    if (raw === 'tg' || raw === 'telangana') setSelectedFilter('TG');
    else if (raw === 'ap' || raw === 'andhra' || raw === 'andhrapradesh' || raw === 'andhra-pradesh') setSelectedFilter('AP');
    else if (raw === 'chitoor' || raw === 'chittoor') setSelectedFilter('Chitoor');
    else setSelectedFilter('All');
  }, [params.state]);

  const visibleData = useMemo(() => {
    const term = normalizeText(searchTerm);
    if (!term) return filteredData;

    return filteredData.filter((p) => {
      const haystack = normalizeText(
        [
          p.sl_no,
          p.customer_name,
          p.mobile_no,
          p.project_capacity,
          p.total_quoted_cost,
          p.total_exp,
          p.payment_received,
          p.pending_payment,
          p.profit_right_now,
          p.overall_profit,
          p.state,
          p.project_id,
        ].join(' ')
      );
      return haystack.includes(term);
    });
  }, [filteredData, searchTerm]);

  const analytics = useMemo(() => {
    const rows = visibleData;
    const count = rows.length;
    const sum = (getter: (p: ProjectData) => number) => rows.reduce((acc, p) => acc + (Number(getter(p)) || 0), 0);
    const avg = (getter: (p: ProjectData) => number) => (count > 0 ? sum(getter) / count : 0);

    return {
      count,
      avgCapacity: avg((p) => p.project_capacity || 0),
      avgQuoted: avg((p) => p.total_quoted_cost || 0),
      avgExp: avg((p) => p.total_exp || 0),
      avgReceived: avg((p) => p.payment_received || 0),
      avgPending: avg((p) => p.pending_payment || 0),
      avgProfitNow: avg((p) => p.profit_right_now || 0),
      avgOverallProfit: avg((p) => p.overall_profit || 0),
      totalCapacity: sum((p) => p.project_capacity || 0),
      totalQuoted: sum((p) => p.total_quoted_cost || 0),
      totalExp: sum((p) => p.total_exp || 0),
      totalReceived: sum((p) => p.payment_received || 0),
      totalPending: sum((p) => p.pending_payment || 0),
      totalProfitNow: sum((p) => p.profit_right_now || 0),
      totalOverallProfit: sum((p) => p.overall_profit || 0),
    };
  }, [visibleData]);

  const fetchProjectAnalysisData = React.useCallback(async (opts?: { skipLoading?: boolean }) => {
    try {
      if (!opts?.skipLoading) setIsLoading(true);

      // Strategy:
      // - Fetch project_analysis table as the PRIMARY SOURCE OF TRUTH (all saved/edited data)
      // - Also fetch projects + chitoor_projects to show all projects (even if no analysis record yet)
      // - ONLY use source tables as fallback for projects that have no analysis record
      // - NEVER overwrite saved analysis data with baseline data

      const [{ data: analysisRows, error: analysisError }, { data: projects, error: projectError }, { data: chitoorProjects, error: chitoorError }] =
        await Promise.all([
          fetchAllRows<ProjectData>(supabase.from('project_analysis').select('*').order('updated_at', { ascending: false })),
          fetchAllRows<any>(
            supabase
              .from('projects')
              .select('id, customer_name, phone, proposal_amount, kwh, state, paid_amount, advance_payment, balance_amount, created_at, updated_at')
              .neq('status', 'deleted')
              .order('created_at', { ascending: false })
          ),
          fetchAllRows<any>(supabase.from('chitoor_projects').select('*').order('created_at', { ascending: false })),
        ]);

      if (projectError) throw projectError;

      // Build a map of saved analysis data (SOURCE OF TRUTH)
      const analysisByProjectId = new Map<string, ProjectData>();
      (analysisRows || []).forEach((r) => {
        const normalized = normalizeDbProjectAnalysisRow(r as unknown as Record<string, unknown>);
        const key = String(normalized.project_id || normalized.id || '');
        // Keep the MOST RECENTLY UPDATED record for each project (updated_at is DESC)
        if (key && !analysisByProjectId.has(key)) {
          analysisByProjectId.set(key, normalized);
        }
      });

      // Build final data set: use saved analysis data when available, baseline only as fallback
      const transformedProjects: ProjectData[] = (projects || []).map((project: any) => {
        const projectId = String(project.id);
        const saved = analysisByProjectId.get(projectId);

        // If we have saved analysis data, return it as-is (it's the source of truth)
        if (saved) {
          return { ...saved, id: projectId, project_id: projectId };
        }

        // Otherwise, create baseline from source table (for projects with no analysis record yet)
        const baseline: ProjectData = {
          id: projectId,
          project_id: projectId,
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
          created_at: project.created_at || undefined,
          updated_at: project.updated_at || undefined,
        };

        return baseline;
      });

      let chitoorTransformed: ProjectData[] = [];
      if (!chitoorError && Array.isArray(chitoorProjects) && chitoorProjects.length > 0) {
        chitoorTransformed = chitoorProjects.map((project: any) => {
          const projectId = String(project.id);
          const saved = analysisByProjectId.get(projectId);

          // If we have saved analysis data for this Chitoor project, return it as-is
          if (saved) {
            return { ...saved, id: projectId, project_id: projectId };
          }

          // Otherwise, create baseline from Chitoor source table
          const paymentReceived = project.amount_received || 0;
          const totalCost = project.project_cost || 0;
          const pendingPayment = totalCost - paymentReceived;
          const baseline: ProjectData = {
            id: projectId,
            project_id: projectId,
            sl_no: 0,
            customer_name: project.customer_name || '',
            mobile_no: project.mobile_number || project.mobile_no || '',
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
            pending_payment: pendingPayment,
            profit_right_now: 0,
            overall_profit: 0,
            state: 'Chitoor',
            created_at: project.created_at || undefined,
            updated_at: project.updated_at || undefined,
          };

          return baseline;
        });
      }

      const allProjects = [...transformedProjects, ...chitoorTransformed];

      if (analysisError) {
        const errorCode = (analysisError as any)?.code;
        const errorMessage = (analysisError as any)?.message || String(analysisError);
        console.warn('Project analysis overlay fetch error (continuing with baseline rows):', errorCode, errorMessage);
      }

      // Always show all projects (baseline + saved overlay)
      setProjectData(allProjects);
    } catch (error: any) {
      console.error('Error fetching project analysis:', error?.message || String(error));
      toast({
        title: 'Error',
        description: error?.message || 'Failed to fetch project analysis data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setProjectData([]);
    } finally {
      if (!opts?.skipLoading) setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAuthenticated && isAnalysisUnlocked) {
      checkAndInitializeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAnalysisUnlocked]);

  useEffect(() => {
    // Apply state filter to project data
    if (selectedFilter !== 'All' && projectData.length > 0) {
      const filtered = projectData.filter((project) => getProjectBucket(project) === selectedFilter);
      setFilteredData(filtered);
    } else {
      setFilteredData(projectData);
    }
  }, [selectedFilter, projectData]);

  useEffect(() => {
    if (!isAuthenticated || !isAnalysisUnlocked) return;

    let resubscribeTimeout: NodeJS.Timeout;
    let unsubscribe: (() => void) | null = null;

    // Subscribe to project_analysis changes
    unsubscribe = subscribeToProjectAnalysis((payload) => {
      console.log('Project analysis realtime update:', payload);
      fetchProjectAnalysisData({ skipLoading: true });
    });

    // Also keep the analysis view "live" as new rows are added/edited from projects table
    const channel = supabase
      .channel('project-analysis-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'projects' },
        (payload: any) => {
          console.log('New project added:', payload);
          fetchProjectAnalysisData({ skipLoading: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chitoor_projects' },
        (payload: any) => {
          console.log('Chitoor projects table changed:', payload);
          fetchProjectAnalysisData({ skipLoading: true });
        }
      )
      .subscribe((status: any) => {
        console.log('Realtime subscription status:', status);

        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('Realtime subscription closed/error, will attempt reconnect in 5s');
          resubscribeTimeout = setTimeout(() => {
            if (isAuthenticated && isAnalysisUnlocked) {
              console.log('Attempting to reconnect realtime subscription');
              void supabase.removeChannel(channel);
              void fetchProjectAnalysisData({ skipLoading: true });
            }
          }, 5000);
        }
      });

    return () => {
      clearTimeout(resubscribeTimeout);
      void supabase.removeChannel(channel);
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, isAnalysisUnlocked, fetchProjectAnalysisData]);

  const handleUnlockAnalysis = () => {
    if (passwordInput === 'Axiso@2024') {
      setIsAnalysisUnlocked(true);
      setPasswordInput('');
      toast({
        title: 'Access granted',
        description: 'Project Analysis unlocked',
        status: 'success',
        duration: 3,
        isClosable: true,
      });
    } else {
      toast({
        title: 'Incorrect password',
        description: 'Please enter the correct Project Analysis password',
        status: 'error',
        duration: 3,
        isClosable: true,
      });
    }
  };

  const checkAndInitializeData = async () => {
    try {
      const isEmpty = await checkProjectAnalysisEmpty();

      // Always sync/migrate all projects to ensure project_analysis has complete data
      // This will upsert all 220 projects and preserve already-updated analysis data
      if (isEmpty) {
        console.log('Project analysis table is empty, running full migration...');
        setShowMigrationPrompt(true);
        const result = await migrateProjectsToAnalysis();
        if (result.success) {
          console.log(`Migration completed: ${result.recordsMigrated} records`);
        }
      } else {
        // Even if not empty, sync any new projects
        console.log('Project analysis has data, syncing any new projects...');
        await syncNewProjectsToAnalysis(toast);
      }

      await fetchProjectAnalysisData();
    } catch (error) {
      console.error('Error checking data:', error);
      await fetchProjectAnalysisData();
    }
  };

  const handleEditProject = async (project: ProjectData) => {
    setSelectedProject(project);

    // Fetch ALL payment receipts including advance payments
    try {
      const projectId = project.project_id || project.id;

      // Fetch from payment_history table for regular projects
      const { data: paymentHistory, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (!error || (error as any)?.code === 'PGRST116') {
        let allPayments: any[] = paymentHistory || [];

        // Try to fetch the project details to check for advance payment
        const { data: projectDetails } = await supabase
          .from('projects')
          .select('advance_payment, start_date, created_at, payment_mode')
          .eq('id', projectId)
          .single();

        // If advance payment exists, add it as the first payment
        if (projectDetails && projectDetails.advance_payment && projectDetails.advance_payment > 0) {
          const advanceDate = projectDetails.start_date || projectDetails.created_at;
          const advancePayment = {
            id: 'advance',
            amount: projectDetails.advance_payment,
            created_at: advanceDate || new Date().toISOString(),
            payment_date: advanceDate || new Date().toISOString(),
            payment_mode: projectDetails.payment_mode || 'Cash',
            is_advance: true,
          };

          // Check if advance payment is already in the list (to avoid duplicates)
          const advanceExists = allPayments.some((p: any) =>
            p.amount === advancePayment.amount &&
            p.payment_date === advancePayment.payment_date
          );

          if (!advanceExists) {
            allPayments = [advancePayment, ...allPayments];
          }
        }

        // Map all payments to array of dates with amounts
        const paymentDates = allPayments.map((payment: any) => {
          const dateStr = payment.payment_date || payment.created_at || '';
          const amount = payment.amount || 0;
          const dateFormatted = dateStr.split('T')[0]; // Get YYYY-MM-DD from ISO date
          const label = payment.is_advance ? '(Advance)' : '';
          return dateFormatted ? `${dateFormatted} (₹${Number(amount).toLocaleString()}) ${label}`.trim() : '';
        }).filter(Boolean);

        setSelectedProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            payment_dates: paymentDates.length > 0 ? paymentDates : prev.payment_dates || [],
          };
        });
      } else if (error) {
        console.error('Error fetching payment history:', error);
      }
    } catch (err) {
      console.error('Error in handleEditProject:', err);
    }

    onOpen();
  };

  const handleSaveProject = async () => {
    if (!selectedProject) return;

    const canonicalId = String(selectedProject.project_id || selectedProject.id || '').trim();
    if (!canonicalId) {
      toast({
        title: 'Error',
        description: 'This row has no project id — cannot save to project_analysis.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      // Check if project exists before saving
      const projectExists = await checkProjectExists(canonicalId);
      if (!projectExists) {
        toast({
          title: 'Project Not Found',
          description: `No project found with ID: ${canonicalId}. Make sure the project exists in the projects table before saving project analysis.`,
          status: 'error',
          duration: 8000,
          isClosable: true,
        });
        return;
      }

      // Prepare data with auto-calculations
      const dataToSave = prepareProjectAnalysisForSave({
        ...selectedProject,
        project_id: canonicalId,
      });

      // Use upsert to handle both insert and update cases
      const { data, error } = await upsertProjectAnalysis(dataToSave as Partial<ProjectAnalysisData>);

      if (error) {
        throw error;
      }

      // Refresh data
      await fetchProjectAnalysisData({ skipLoading: true });

      toast({
        title: 'Success',
        description: 'Project analysis updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onClose();
    } catch (error: any) {
      console.error('Error saving project:', error?.message || String(error));
      const msg = getErrorMessage(error);
      toast({
        title: 'Error',
        description: msg,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  // Helper function to parse and format error messages
  const getErrorMessage = (error: any): string => {
    if (!error) return 'Failed to save project analysis';

    const errorMsg = error?.message || String(error);

    // Check for RLS policy errors
    if (/row-level security|RLS|42501/i.test(errorMsg)) {
      return `${errorMsg} — add/update Supabase policies for project_analysis (INSERT/UPDATE).`;
    }

    // Check for foreign key constraint errors
    if (/foreign key|fk_project_id|violates.*constraint/i.test(errorMsg)) {
      return `The project associated with this analysis does not exist. Please ensure the project exists in the system before saving.`;
    }

    return errorMsg || 'Failed to save project analysis';
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project analysis?')) return;

    try {
      const { success, error } = await deleteProjectAnalysis(projectId);

      if (error) {
        throw error;
      }

      setProjectData(projectData.filter((p) => p.project_id !== projectId));
      toast({
        title: 'Success',
        description: 'Project analysis deleted successfully',
        status: 'success',
        duration: 3,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error deleting project:', error?.message || String(error));
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete project analysis',
        status: 'error',
        duration: 3,
        isClosable: true,
      });
    }
  };

  const exportToExcel = () => {
    if (visibleData.length === 0) {
      toast({
        title: 'Export Error',
        description: 'No projects available to export',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const dataToExport = visibleData.map(project => ({
      'Customer Name': project.customer_name,
      'Mobile No': project.mobile_no,
      'Capacity (kW)': project.project_capacity,
      'Total Quoted Cost': project.total_quoted_cost,
      'Total Exp': project.total_exp || 0,
      'Payment Received': project.payment_received || 0,
      'Pending Payment': project.pending_payment || 0,
      'Profit Right Now': project.profit_right_now || 0,
      'Overall Profit': project.overall_profit || 0,
      'State': project.state || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project Analysis');

    // Generate Excel file and trigger download
    const fileName = `project_analysis_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: 'Success',
      description: `Exported ${visibleData.length} projects to Excel`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleMigrateData = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateProjectsToAnalysis();

      if (result.success) {
        toast({
          title: 'Migration Successful',
          description: result.message,
          status: 'success',
          duration: 4,
          isClosable: true,
        });
        setShowMigrationPrompt(false);
        await fetchProjectAnalysisData();
      } else {
        toast({
          title: 'Migration Failed',
          description: result.error || result.message,
          status: 'error',
          duration: 4,
          isClosable: true,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Migration failed',
        status: 'error',
        duration: 4,
        isClosable: true,
      });
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isAnalysisUnlocked) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="70vh">
        <Card w="400px" p={6}>
          <CardHeader pb={2}>
            <Heading size="md">Project Analysis Access</Heading>
            <Text fontSize="sm" color="gray.600" mt={2}>
              This section is protected with an additional password for extra security.
            </Text>
          </CardHeader>
          <CardBody pt={0}>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel fontSize="sm">Enter Access Password</FormLabel>
                <Input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUnlockAnalysis();
                    }
                  }}
                />
              </FormControl>
              <Button colorScheme="blue" onClick={handleUnlockAnalysis}>
                Unlock Project Analysis
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="70vh">
        <VStack spacing={6}>
          <Text fontSize="6xl">📊</Text>
          <Text fontSize="lg" color="gray.600">
            Loading project analysis...
          </Text>
          <Progress size="md" isIndeterminate w="300px" colorScheme="brand" borderRadius="full" />
          <Text fontSize="xs" color="gray.500" maxW="300px" textAlign="center">
            This may take a moment while we load your project data
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box>
      <VStack spacing={6} align="stretch">
          {/* Migration Prompt */}
          {showMigrationPrompt && (
            <Card bg="blue.50" borderColor="blue.200" borderWidth={1}>
              <CardBody>
                <VStack spacing={3} align="stretch">
                  <Flex justify="space-between" align="start" gap={4}>
                    <Box flex={1}>
                      <Heading size="sm" color="blue.800" mb={2}>
                        Migrate Project Data
                      </Heading>
                      <Text color="blue.700" fontSize="sm">
                        Your projects table has data that can be migrated to the project analysis table. This will help you track costs and profits for each project.
                      </Text>
                    </Box>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      onClick={handleMigrateData}
                      isLoading={isMigrating}
                      loadingText="Migrating..."
                    >
                      Migrate Now
                    </Button>
                  </Flex>
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* Header */}
          <Box>
            <Heading size="lg" color="gray.800" mb={2}>
              Project Analysis
            </Heading>
            <Text color="gray.600">
              {selectedFilter === 'All'
                ? 'Detailed cost and profit analysis for all projects'
                : `Detailed cost and profit analysis for ${selectedFilter} projects`}
            </Text>
          </Box>

          {/* Search bar and Export button (top) */}
          <Card bg={cardBg} shadow="sm" border="1px solid" borderColor="gray.100">
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Flex gap={3} align="end">
                  <InputGroup flex={1}>
                    <InputLeftElement>
                      <SearchIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      placeholder="Search by any keyword (name, phone, state, amounts...)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      bg="gray.50"
                      border="1px solid"
                      borderColor="gray.200"
                      _focus={{ bg: 'white', borderColor: 'brand.400' }}
                    />
                  </InputGroup>
                  <Button
                    leftIcon={<RepeatIcon />}
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        // Run fresh migration to clear and rebuild with all 220 projects
                        const result = await freshMigrateProjectsToAnalysis();
                        if (result.success) {
                          toast({
                            title: 'Success',
                            description: `Migrated ${result.recordsMigrated} projects to database`,
                            status: 'success',
                            duration: 3,
                            isClosable: true,
                          });
                        } else {
                          toast({
                            title: 'Migration Error',
                            description: result.error || result.message,
                            status: 'error',
                            duration: 3,
                            isClosable: true,
                          });
                        }
                        // Reload data after migration
                        await fetchProjectAnalysisData();
                      } catch (error) {
                        console.error('Error during fetch all:', error);
                        toast({
                          title: 'Error',
                          description: 'Failed to migrate projects',
                          status: 'error',
                          duration: 3,
                          isClosable: true,
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    colorScheme="blue"
                    variant="outline"
                    isLoading={isLoading}
                    title="Fetch all 220 projects from database and rebuild project_analysis table"
                  >
                    Fetch All
                  </Button>
                  <Button
                    leftIcon={<DownloadIcon />}
                    onClick={exportToExcel}
                    colorScheme="green"
                    variant="outline"
                    isDisabled={visibleData.length === 0}
                  >
                    Export to Excel
                  </Button>
                </Flex>
                <Text fontSize="sm" color="gray.600">
                  Showing <b>{visibleData.length}</b> of <b>{projectData.length}</b> projects
                  {selectedFilter !== 'All' && <> in <b>{selectedFilter}</b></>}
                </Text>
              </VStack>
            </CardBody>
          </Card>

          {/* Analytics cards - Compact Tab View */}
          <Card bg={cardBg} shadow="sm" border="1px solid" borderColor="gray.100">
            <CardHeader pb={2}>
              <Heading size="sm" color="gray.800">Quick Analytics</Heading>
            </CardHeader>
            <CardBody pt={0}>
              <Tabs variant="enclosed" size="sm">
                <TabList mb={3}>
                  <Tab fontSize="sm" fontWeight="medium">Overview</Tab>
                  <Tab fontSize="sm" fontWeight="medium">Average</Tab>
                  <Tab fontSize="sm" fontWeight="medium">Totals</Tab>
                </TabList>

                <TabPanels>
                  {/* Overview Tab */}
                  <TabPanel>
                    <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
                      <Box p={3} bg="brand.50" borderRadius="lg" border="1px solid" borderColor="brand.100">
                        <Text fontSize="xs" color="gray.600" fontWeight="medium" mb={1}>Projects Count</Text>
                        <Text fontSize="xl" fontWeight="bold" color="brand.600">{analytics.count}</Text>
                      </Box>
                      <Box p={3} bg="green.50" borderRadius="lg" border="1px solid" borderColor="green.100">
                        <Text fontSize="xs" color="gray.600" fontWeight="medium" mb={1}>Avg Received</Text>
                        <Text fontSize="lg" fontWeight="bold" color="green.600">₹{Math.round(analytics.avgReceived / 1000)}K</Text>
                      </Box>
                      <Box p={3} bg="orange.50" borderRadius="lg" border="1px solid" borderColor="orange.100">
                        <Text fontSize="xs" color="gray.600" fontWeight="medium" mb={1}>Avg Pending</Text>
                        <Text fontSize="lg" fontWeight="bold" color="orange.600">₹{Math.round(analytics.avgPending / 1000)}K</Text>
                      </Box>
                      <Box p={3} bg="purple.50" borderRadius="lg" border="1px solid" borderColor="purple.100">
                        <Text fontSize="xs" color="gray.600" fontWeight="medium" mb={1}>Avg Profit</Text>
                        <Text fontSize="lg" fontWeight="bold" color="purple.600">₹{Math.round(analytics.avgProfitNow / 1000)}K</Text>
                      </Box>
                    </SimpleGrid>
                  </TabPanel>

                  {/* Average Tab */}
                  <TabPanel>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                      <Box p={3} bg="gray.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Avg Capacity</Text>
                            <Text fontSize="lg" fontWeight="bold" color="gray.800">{analytics.avgCapacity.toFixed(2)}</Text>
                          </VStack>
                          <Badge colorScheme="blue" px={2} py={1}>kW</Badge>
                        </Flex>
                      </Box>
                      <Box p={3} bg="gray.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Avg Quoted Cost</Text>
                            <Text fontSize="lg" fontWeight="bold" color="gray.800">₹{Math.round(analytics.avgQuoted / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                      <Box p={3} bg="gray.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Avg Expenditure</Text>
                            <Text fontSize="lg" fontWeight="bold" color="gray.800">₹{Math.round(analytics.avgExp / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                      <Box p={3} bg="green.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Avg Received</Text>
                            <Text fontSize="lg" fontWeight="bold" color="green.700">₹{Math.round(analytics.avgReceived / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                      <Box p={3} bg="orange.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Avg Pending</Text>
                            <Text fontSize="lg" fontWeight="bold" color="orange.700">₹{Math.round(analytics.avgPending / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                      <Box p={3} bg="purple.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Avg Profit</Text>
                            <Text fontSize="lg" fontWeight="bold" color="purple.700">₹{Math.round(analytics.avgProfitNow / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                    </SimpleGrid>
                  </TabPanel>

                  {/* Totals Tab */}
                  <TabPanel>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                      <Box p={3} bg="gray.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Total Capacity</Text>
                            <Text fontSize="lg" fontWeight="bold" color="gray.800">{analytics.totalCapacity.toFixed(2)}</Text>
                          </VStack>
                          <Badge colorScheme="blue" px={2} py={1}>kW</Badge>
                        </Flex>
                      </Box>
                      <Box p={3} bg="gray.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Total Quoted Cost</Text>
                            <Text fontSize="lg" fontWeight="bold" color="gray.800">₹{Math.round(analytics.totalQuoted / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                      <Box p={3} bg="gray.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Total Expenditure</Text>
                            <Text fontSize="lg" fontWeight="bold" color="gray.800">₹{Math.round(analytics.totalExp / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                      <Box p={3} bg="green.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Total Received</Text>
                            <Text fontSize="lg" fontWeight="bold" color="green.700">₹{Math.round(analytics.totalReceived / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                      <Box p={3} bg="orange.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Total Pending</Text>
                            <Text fontSize="lg" fontWeight="bold" color="orange.700">₹{Math.round(analytics.totalPending / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                      <Box p={3} bg="purple.50" borderRadius="lg">
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontWeight="medium">Total Profit</Text>
                            <Text fontSize="lg" fontWeight="bold" color="purple.700">₹{Math.round(analytics.totalOverallProfit / 1000)}K</Text>
                          </VStack>
                        </Flex>
                      </Box>
                    </SimpleGrid>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </CardBody>
          </Card>

          {/* Projects Table */}
          <Card bg={cardBg} shadow="sm" border="1px solid" borderColor="gray.100">
            <CardHeader>
              <Flex justify="space-between" align="center">
                <Box>
                  <Heading size="md" color="gray.800">
                    Project Details & Analysis
                  </Heading>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    {visibleData.length} {selectedFilter !== 'All' ? `${selectedFilter} ` : ''}projects with cost breakdown
                    <Text as="span" fontSize="xs" color="gray.500" ml={2}>
                      (out of {projectData.length} total)
                    </Text>
                  </Text>
                </Box>
              </Flex>
            </CardHeader>
            <CardBody pt={0} overflowX="auto">
              {visibleData.length > 0 ? (
              <Table variant="simple" size="sm">
                <Thead bg="gray.50">
                  <Tr>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Customer Name
                    </Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Mobile No
                    </Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Capacity (kW)
                    </Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Total Quoted Cost
                    </Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Total Exp
                    </Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Payment Received
                    </Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Pending Payment
                    </Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Profit Right Now
                    </Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Overall Profit
                    </Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      Actions
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {visibleData.map((project) => (
                    <Tr key={project.id} _hover={{ bg: 'gray.50' }}>
                      <Td>
                        <Text fontSize="sm">{project.customer_name}</Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm">{project.mobile_no}</Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm">{project.project_capacity}</Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" fontWeight="medium">
                          ₹{project.total_quoted_cost.toLocaleString()}
                        </Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" color={project.total_exp ? 'gray.700' : 'gray.400'}>
                          ₹{(project.total_exp || 0).toLocaleString()}
                        </Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" color="green.600" fontWeight="medium">
                          ₹{(project.payment_received || 0).toLocaleString()}
                        </Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" color="orange.600" fontWeight="medium">
                          ₹{(project.pending_payment || 0).toLocaleString()}
                        </Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" fontWeight="medium">
                          ₹{(project.profit_right_now || 0).toLocaleString()}
                        </Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" fontWeight="medium">
                          ₹{(project.overall_profit || 0).toLocaleString()}
                        </Text>
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <Button size="sm" colorScheme="blue" onClick={() => handleEditProject(project)}>
                            Edit
                          </Button>
                          <IconButton
                            aria-label="Delete"
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            variant="ghost"
                            onClick={() => handleDeleteProject(project.id)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <Flex direction="column" align="center" py={12}>
                <Text fontSize="6xl" color="gray.300" mb={4}>
                  📋
                </Text>
                <Text color="gray.500" fontSize="lg" fontWeight="medium">
                  No projects found
                </Text>
                <Text color="gray.400" fontSize="sm" mb={4}>
                  {searchTerm.trim()
                    ? 'No projects match your search. Try a different keyword.'
                    : 'Projects will appear here once they are created in the Projects section'}
                </Text>
                <Button
                  size="sm"
                  colorScheme="brand"
                  onClick={() => window.location.hash = '#/projects'}
                >
                  Go to Projects
                </Button>
              </Flex>
            )}
            </CardBody>
          </Card>
      </VStack>

      {/* Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Project Analysis - {selectedProject?.customer_name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedProject && (
              <VStack spacing={4} align="stretch">
                {/* Read-only fields from projects table */}
                <FormControl isDisabled>
                  <FormLabel>Customer Name</FormLabel>
                  <Input value={selectedProject.customer_name} />
                </FormControl>

                <FormControl isDisabled>
                  <FormLabel>Mobile No</FormLabel>
                  <Input value={selectedProject.mobile_no} />
                </FormControl>

                <FormControl isDisabled>
                  <FormLabel>Project Capacity (kW)</FormLabel>
                  <Input type="number" value={selectedProject.project_capacity} />
                </FormControl>

                <FormControl isDisabled>
                  <FormLabel>Total Quoted Cost (₹)</FormLabel>
                  <Input type="number" value={selectedProject.total_quoted_cost} />
                </FormControl>

                {/* Timeline Section - BEFORE Cost Details */}
                <Box borderTop="2px solid" borderColor="gray.200" pt={4}>
                  <Text fontWeight="bold" mb={4} color="gray.700">
                    Timeline (Optional)
                  </Text>

                  <VStack spacing={3}>
                    <FormControl>
                      <FormLabel fontSize="sm">Project Start Date</FormLabel>
                      <Input
                        type="date"
                        value={selectedProject.project_start_date || ''}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            project_start_date: e.target.value,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Completion Date</FormLabel>
                      <Input
                        type="date"
                        value={selectedProject.completion_date || ''}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            completion_date: e.target.value,
                          })
                        }
                      />
                    </FormControl>

                    <Box w="100%">
                      <FormLabel fontSize="sm" mb={3}>Payment Received Dates</FormLabel>
                      <VStack spacing={2} align="stretch">
                        {(selectedProject.payment_dates || []).map((dateEntry, index) => {
                          // Parse date entry - format is "YYYY-MM-DD (₹amount) [optional label]"
                          const dateMatch = (dateEntry || '').match(/^(\d{4}-\d{2}-\d{2})/);
                          const dateValue = dateMatch ? dateMatch[1] : dateEntry;
                          const amountMatch = (dateEntry || '').match(/\(₹([\d,]+)\)/);
                          const amount = amountMatch ? amountMatch[1] : '';
                          const labelMatch = (dateEntry || '').match(/\((Advance)\)$/);
                          const isAdvance = !!labelMatch;

                          return (
                            <HStack key={index} spacing={2} align="start">
                              <FormControl>
                                <FormLabel fontSize="xs" color="gray.600">Date</FormLabel>
                                <Input
                                  type="date"
                                  value={dateValue || ''}
                                  onChange={(e) => {
                                    const updatedDates = [...(selectedProject.payment_dates || [])];
                                    const label = isAdvance ? ' (₹' + amount + ') (Advance)' : (amount ? ` (₹${amount})` : '');
                                    const newEntry = e.target.value + label;
                                    updatedDates[index] = newEntry;
                                    setSelectedProject({
                                      ...selectedProject,
                                      payment_dates: updatedDates,
                                    });
                                  }}
                                  size="sm"
                                />
                              </FormControl>
                              {amount && (
                                <FormControl>
                                  <FormLabel fontSize="xs" color="gray.600">Amount</FormLabel>
                                  <Input
                                    type="text"
                                    value={`₹${amount}`}
                                    isReadOnly
                                    bg="gray.100"
                                    size="sm"
                                  />
                                </FormControl>
                              )}
                              {isAdvance && (
                                <Box>
                                  <FormLabel fontSize="xs" color="gray.600">Type</FormLabel>
                                  <Box
                                    px={2}
                                    py={1}
                                    bg="blue.100"
                                    color="blue.700"
                                    borderRadius="md"
                                    fontSize="xs"
                                    fontWeight="medium"
                                    textAlign="center"
                                  >
                                    Advance
                                  </Box>
                                </Box>
                              )}
                              <IconButton
                                aria-label="Remove date"
                                icon={<DeleteIcon />}
                                size="sm"
                                colorScheme="red"
                                variant="ghost"
                                mt={6}
                                onClick={() => {
                                  const updatedDates = selectedProject.payment_dates?.filter(
                                    (_, i) => i !== index
                                  ) || [];
                                  setSelectedProject({
                                    ...selectedProject,
                                    payment_dates: updatedDates,
                                  });
                                }}
                              />
                            </HStack>
                          );
                        })}
                        <Button
                          size="sm"
                          colorScheme="blue"
                          variant="outline"
                          onClick={() => {
                            setSelectedProject({
                              ...selectedProject,
                              payment_dates: [...(selectedProject.payment_dates || []), ''],
                            });
                          }}
                        >
                          + Add Payment Date
                        </Button>
                      </VStack>
                    </Box>
                  </VStack>
                </Box>

                {/* Cost Details Section */}
                <Box borderTop="2px solid" borderColor="gray.200" pt={4}>
                  <Text fontWeight="bold" mb={4} color="gray.700">
                    Cost Details (Manual Entry)
                  </Text>

                  <VStack spacing={3}>
                    <FormControl>
                      <FormLabel fontSize="sm">Application Charges (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.application_charges || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            application_charges: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Modules Cost (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.modules_cost || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            modules_cost: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Inverter Cost (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.inverter_cost || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            inverter_cost: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Structure Cost (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.structure_cost || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            structure_cost: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Hardware Cost (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.hardware_cost || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            hardware_cost: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Electrical Equipment (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.electrical_equipment || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            electrical_equipment: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Transport Segments (₹)</FormLabel>
                      <VStack align="stretch" spacing={3}>
                        {normalizeTransportSegments(selectedProject.transport_segments).map((seg, idx) => (
                          <HStack key={`${idx}-${seg.label}`} spacing={2} align="flex-start">
                            <Input
                              placeholder="Element text (e.g., ETTX / DD element)"
                              value={seg.label}
                              onChange={(e) =>
                                setSelectedProject((prev) => {
                                  if (!prev) return prev;
                                  const current = normalizeTransportSegments(prev.transport_segments);
                                  const next = current.map((x, i) =>
                                    i === idx ? { ...x, label: e.target.value } : x
                                  );
                                  const nextSum = sumTransportSegments(next);
                                  return {
                                    ...prev,
                                    transport_segments: next,
                                    transport_segment: nextSum,
                                  };
                                })
                              }
                            />
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={seg.amount}
                              w="160px"
                              onChange={(e) =>
                                setSelectedProject((prev) => {
                                  if (!prev) return prev;
                                  const current = normalizeTransportSegments(prev.transport_segments);
                                  const amt = parseFloat(e.target.value) || 0;
                                  const next = current.map((x, i) =>
                                    i === idx ? { ...x, amount: amt } : x
                                  );
                                  const nextSum = sumTransportSegments(next);
                                  return {
                                    ...prev,
                                    transport_segments: next,
                                    transport_segment: nextSum,
                                  };
                                })
                              }
                            />
                            <IconButton
                              aria-label="Remove transport element"
                              icon={<DeleteIcon />}
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() =>
                                setSelectedProject((prev) => {
                                  if (!prev) return prev;
                                  const current = normalizeTransportSegments(prev.transport_segments);
                                  const next = current.filter((_, i) => i !== idx);
                                  const nextSum = sumTransportSegments(next);
                                  return {
                                    ...prev,
                                    transport_segments: next,
                                    transport_segment: nextSum,
                                  };
                                })
                              }
                            />
                          </HStack>
                        ))}

                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="green"
                          onClick={() =>
                            setSelectedProject((prev) => {
                              if (!prev) return prev;
                              const current = normalizeTransportSegments(prev.transport_segments);
                              const next =
                                current.length === 0
                                  ? [{ label: '', amount: prev.transport_segment || 0 }]
                                  : [...current, { label: '', amount: 0 }];
                              const nextSum = sumTransportSegments(next);
                              return {
                                ...prev,
                                transport_segments: next,
                                transport_segment: nextSum,
                              };
                            })
                          }
                        >
                          + Add element
                        </Button>

                        <HStack justify="space-between">
                          <Text fontSize="sm" color="gray.600">Transport Segment Total</Text>
                          <Text fontSize="sm" fontWeight="bold" color="gray.800">
                            ₹{sumTransportSegments(selectedProject.transport_segments).toLocaleString()}
                          </Text>
                        </HStack>
                      </VStack>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Transport Total (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.transport_total || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            transport_total: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Installation Cost (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.installation_cost || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            installation_cost: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Subsidy Application (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.subsidy_application || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            subsidy_application: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Misc Dept Charges (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.misc_dept_charges || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            misc_dept_charges: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Dept Charges (₹)</FormLabel>
                      <VStack align="stretch" spacing={3}>
                        {normalizeTransportSegments(selectedProject.dept_charges_segments).map((seg, idx) => (
                          <HStack key={`${idx}-${seg.label}`} spacing={2} align="flex-start">
                            <Input
                              placeholder="Element text (e.g., Dept head)"
                              value={seg.label}
                              onChange={(e) =>
                                setSelectedProject((prev) => {
                                  if (!prev) return prev;
                                  const current = normalizeTransportSegments(prev.dept_charges_segments);
                                  const next = current.map((x, i) =>
                                    i === idx ? { ...x, label: e.target.value } : x
                                  );
                                  const nextSum = sumTransportSegments(next);
                                  return {
                                    ...prev,
                                    dept_charges_segments: next,
                                    dept_charges: nextSum,
                                  };
                                })
                              }
                            />
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={seg.amount}
                              w="160px"
                              onChange={(e) =>
                                setSelectedProject((prev) => {
                                  if (!prev) return prev;
                                  const current = normalizeTransportSegments(prev.dept_charges_segments);
                                  const amt = parseFloat(e.target.value) || 0;
                                  const next = current.map((x, i) =>
                                    i === idx ? { ...x, amount: amt } : x
                                  );
                                  const nextSum = sumTransportSegments(next);
                                  return {
                                    ...prev,
                                    dept_charges_segments: next,
                                    dept_charges: nextSum,
                                  };
                                })
                              }
                            />
                            <IconButton
                              aria-label="Remove dept charge element"
                              icon={<DeleteIcon />}
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() =>
                                setSelectedProject((prev) => {
                                  if (!prev) return prev;
                                  const current = normalizeTransportSegments(prev.dept_charges_segments);
                                  const next = current.filter((_, i) => i !== idx);
                                  const nextSum = sumTransportSegments(next);
                                  return {
                                    ...prev,
                                    dept_charges_segments: next,
                                    dept_charges: nextSum,
                                  };
                                })
                              }
                            />
                          </HStack>
                        ))}

                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="green"
                          onClick={() =>
                            setSelectedProject((prev) => {
                              if (!prev) return prev;
                              const current = normalizeTransportSegments(prev.dept_charges_segments);
                              const next =
                                current.length === 0
                                  ? [{ label: '', amount: prev.dept_charges || 0 }]
                                  : [...current, { label: '', amount: 0 }];
                              const nextSum = sumTransportSegments(next);
                              return {
                                ...prev,
                                dept_charges_segments: next,
                                dept_charges: nextSum,
                              };
                            })
                          }
                        >
                          + Add element
                        </Button>

                        <HStack justify="space-between">
                          <Text fontSize="sm" color="gray.600">Dept Charges Total</Text>
                          <Text fontSize="sm" fontWeight="bold" color="gray.800">
                            ₹
                            {normalizeTransportSegments(selectedProject.dept_charges_segments).length > 0
                              ? sumTransportSegments(selectedProject.dept_charges_segments).toLocaleString()
                              : (selectedProject.dept_charges || 0).toLocaleString()}
                          </Text>
                        </HStack>
                      </VStack>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Civil Work Able (₹)</FormLabel>
                      <VStack align="stretch" spacing={3}>
                        {normalizeTransportSegments(selectedProject.civil_work_segments).map((seg, idx) => (
                          <HStack key={`${idx}-${seg.label}`} spacing={2} align="flex-start">
                            <Input
                              placeholder="Element text (e.g., Foundation / Roofing / Framing)"
                              value={seg.label}
                              onChange={(e) =>
                                setSelectedProject((prev) => {
                                  if (!prev) return prev;
                                  const current = normalizeTransportSegments(prev.civil_work_segments);
                                  const next = current.map((x, i) =>
                                    i === idx ? { ...x, label: e.target.value } : x
                                  );
                                  const nextSum = sumTransportSegments(next);
                                  return {
                                    ...prev,
                                    civil_work_segments: next,
                                    civil_work_cost: nextSum,
                                  };
                                })
                              }
                            />
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={seg.amount}
                              w="160px"
                              onChange={(e) =>
                                setSelectedProject((prev) => {
                                  if (!prev) return prev;
                                  const current = normalizeTransportSegments(prev.civil_work_segments);
                                  const amt = parseFloat(e.target.value) || 0;
                                  const next = current.map((x, i) =>
                                    i === idx ? { ...x, amount: amt } : x
                                  );
                                  const nextSum = sumTransportSegments(next);
                                  return {
                                    ...prev,
                                    civil_work_segments: next,
                                    civil_work_cost: nextSum,
                                  };
                                })
                              }
                            />
                            <IconButton
                              aria-label="Remove civil work element"
                              icon={<DeleteIcon />}
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() =>
                                setSelectedProject((prev) => {
                                  if (!prev) return prev;
                                  const current = normalizeTransportSegments(prev.civil_work_segments);
                                  const next = current.filter((_, i) => i !== idx);
                                  const nextSum = sumTransportSegments(next);
                                  return {
                                    ...prev,
                                    civil_work_segments: next,
                                    civil_work_cost: nextSum,
                                  };
                                })
                              }
                            />
                          </HStack>
                        ))}

                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="green"
                          onClick={() =>
                            setSelectedProject((prev) => {
                              if (!prev) return prev;
                              const current = normalizeTransportSegments(prev.civil_work_segments);
                              const next =
                                current.length === 0
                                  ? [{ label: '', amount: prev.civil_work_cost || 0 }]
                                  : [...current, { label: '', amount: 0 }];
                              const nextSum = sumTransportSegments(next);
                              return {
                                ...prev,
                                civil_work_segments: next,
                                civil_work_cost: nextSum,
                              };
                            })
                          }
                        >
                          + Add element
                        </Button>

                        <HStack justify="space-between">
                          <Text fontSize="sm" color="gray.600">Civil Work Total</Text>
                          <Text fontSize="sm" fontWeight="bold" color="gray.800">
                            ₹
                            {normalizeTransportSegments(selectedProject.civil_work_segments).length > 0
                              ? sumTransportSegments(selectedProject.civil_work_segments).toLocaleString()
                              : (selectedProject.civil_work_cost || 0).toLocaleString()}
                          </Text>
                        </HStack>
                      </VStack>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Total Exp (₹)</FormLabel>
                      <Input
                        type="number"
                        value={calculateTotalExpenses(selectedProject)}
                        isReadOnly
                        bg="gray.100"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Payment Received (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.payment_received || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            payment_received: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Pending Payment (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.pending_payment || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            pending_payment: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Profit Right Now (₹)</FormLabel>
                      <Input
                        type="number"
                        value={calculateProfitRightNow(selectedProject)}
                        isReadOnly
                        bg="gray.100"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Overall Profit (₹)</FormLabel>
                      <Input
                        type="number"
                        value={calculateOverallProfit(selectedProject)}
                        isReadOnly
                        bg="gray.100"
                      />
                    </FormControl>
                  </VStack>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveProject}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ProjectAnalysis;
