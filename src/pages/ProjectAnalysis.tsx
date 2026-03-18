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
} from '@chakra-ui/react';
import { DeleteIcon, SearchIcon, DownloadIcon } from '@chakra-ui/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { migrateProjectsToAnalysis, checkProjectAnalysisEmpty } from '../utils/projectAnalysisMigration';

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
  transport_total?: number;
  installation_cost?: number;
  subsidy_application?: number;
  misc_dept_charges?: number;
  dept_charges?: number;
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

    // Keep the analysis view "live" as new rows are added/edited.
    const channel = supabase
      .channel('project-analysis-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => fetchProjectAnalysisData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_analysis' },
        () => fetchProjectAnalysisData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chitoor_projects' },
        () => fetchProjectAnalysisData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAnalysisUnlocked]);

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
      if (isEmpty) {
        setShowMigrationPrompt(true);
      }
      await fetchProjectAnalysisData();
    } catch (error) {
      console.error('Error checking data:', error);
      await fetchProjectAnalysisData();
    }
  };

  const fetchProjectAnalysisData = async () => {
    try {
      setIsLoading(true);

      // Fetch from project_analysis table
      const { data: analysisData, error: analysisError } = await supabase
        .from('project_analysis')
        .select('*')
        .order('created_at', { ascending: false });

      if (analysisError) {
        const errorCode = (analysisError as any)?.code;
        const errorMessage = (analysisError as any)?.message || String(analysisError);

        // Only log if it's not a "table doesn't exist" error
        if (errorCode !== 'PGRST116') {
          console.error('Analysis data error:', errorCode, errorMessage);
        }
      }

      // If table doesn't exist or is empty, fetch from projects
      if (!analysisData || analysisData.length === 0) {
        const { data: projects, error: projectError } = await supabase
          .from('projects')
          .select('id, customer_name, phone, proposal_amount, kwh, state')
          .neq('status', 'deleted');

        if (projectError) {
          const errorCode = (projectError as any)?.code;
          const errorMessage = (projectError as any)?.message || String(projectError);
          console.error('Project error:', errorCode, errorMessage);

          // If projects table is empty, just show empty state
          if (errorCode === 'PGRST116') {
            setProjectData([]);
          } else {
            throw projectError;
          }
        } else if (projects && projects.length > 0) {
          const transformedProjects: ProjectData[] = projects.map((project: any) => ({
            id: project.id,
            sl_no: 0, // Will be set by database
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
            state: project.state || '',
            created_at: project.created_at || '',
          }));

          // Also fetch Chitoor projects for complete data
          const { data: chitoorProjects, error: chitoorError } = await supabase
            .from('chitoor_projects')
            .select('*')
            .order('created_at', { ascending: false });

          let allProjects = transformedProjects;

          if (!chitoorError && chitoorProjects && chitoorProjects.length > 0) {
            const chitoorTransformed: ProjectData[] = chitoorProjects.map((project: any) => ({
              id: project.id,
              sl_no: 0, // Will be set by database
              customer_name: project.customer_name || '',
              mobile_no: project.mobile_no || '',
              project_capacity: project.capacity || 0,
              total_quoted_cost: project.project_cost || 0,
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
              state: 'Chitoor',
              created_at: project.created_at || '',
            }));
            allProjects = [...transformedProjects, ...chitoorTransformed];
          }

          setProjectData(allProjects);
        } else {
          setProjectData([]);
        }
      } else {
        // project_analysis historically may not have `state`. Enrich it from `projects.state` using project_id.
        const analysisProjectIds = Array.from(
          new Set(
            (analysisData as any[])
              .map((row) => row.project_id || row.id)
              .filter(Boolean)
          )
        );

        const stateByProjectId = new Map<string, string>();
        if (analysisProjectIds.length > 0) {
          const { data: projectStates, error: stateError } = await supabase
            .from('projects')
            .select('id, state')
            .in('id', analysisProjectIds)
            .neq('status', 'deleted');

          if (!stateError && projectStates) {
            for (const row of projectStates as any[]) {
              if (row?.id) stateByProjectId.set(row.id, row.state || '');
            }
          }
        }

        const enrichedAnalysisData: ProjectData[] = (analysisData as any[]).map((row) => {
          const projectId = row.project_id || row.id;
          return {
            ...row,
            state: row.state || stateByProjectId.get(projectId) || '',
          };
        });

        // If analysisData exists, check for Chitoor projects too
        const { data: chitoorProjects, error: chitoorError } = await supabase
          .from('chitoor_projects')
          .select('*')
          .order('created_at', { ascending: false });

        let allData: ProjectData[] = enrichedAnalysisData;

        if (!chitoorError && chitoorProjects && chitoorProjects.length > 0) {
          const chitoorTransformed: ProjectData[] = chitoorProjects.map((project: any) => ({
            id: project.id,
            sl_no: 0, // Will be set by database
            customer_name: project.customer_name || '',
            mobile_no: project.mobile_no || '',
            project_capacity: project.capacity || 0,
            total_quoted_cost: project.project_cost || 0,
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
            state: 'Chitoor',
            created_at: project.created_at || '',
          }));
          allData = [...enrichedAnalysisData, ...chitoorTransformed];
        }

        setProjectData(allData);
      }
    } catch (error: any) {
      console.error('Error fetching project analysis:', error?.message || String(error));
      toast({
        title: 'Error',
        description: error?.message || 'Failed to fetch project analysis data',
        status: 'error',
        duration: 3,
        isClosable: true,
      });
      setProjectData([]);
    } finally {
      setIsLoading(false);
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

    try {
      const { error } = await supabase
        .from('project_analysis')
        .upsert(
          {
            ...selectedProject,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        const errorCode = (error as any)?.code;
        const errorMessage = (error as any)?.message || String(error);
        console.error('Error saving project:', errorCode, errorMessage);
        throw error;
      }

      // Update local state with the saved project
      setProjectData(projectData.map(p => p.id === selectedProject.id ? selectedProject : p));

      toast({
        title: 'Success',
        description: 'Project analysis updated successfully',
        status: 'success',
        duration: 3,
        isClosable: true,
      });

      onClose();
    } catch (error: any) {
      console.error('Error saving project:', error?.message || String(error));
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save project analysis',
        status: 'error',
        duration: 3,
        isClosable: true,
      });
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project analysis?')) return;

    try {
      const { error } = await supabase
        .from('project_analysis')
        .delete()
        .eq('id', id);

      if (error) {
        const errorCode = (error as any)?.code;
        const errorMessage = (error as any)?.message || String(error);
        console.error('Error deleting project:', errorCode, errorMessage);
        throw error;
      }

      setProjectData(projectData.filter((p) => p.id !== id));
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

          {/* Analytics cards (based on visible rows) */}
          <Box>
            <Heading size="sm" color="gray.700" mb={4}>Average Values</Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Visible projects</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">{analytics.count.toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Avg capacity</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">{analytics.avgCapacity.toFixed(2)} kW</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Avg quoted cost</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">₹{Math.round(analytics.avgQuoted).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Avg total exp</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">₹{Math.round(analytics.avgExp).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Avg received</StatLabel>
                    <StatNumber fontSize="2xl" color="green.600">₹{Math.round(analytics.avgReceived).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Avg pending</StatLabel>
                    <StatNumber fontSize="2xl" color="orange.600">₹{Math.round(analytics.avgPending).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Avg profit now</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">₹{Math.round(analytics.avgProfitNow).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Avg overall profit</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">₹{Math.round(analytics.avgOverallProfit).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
            </SimpleGrid>
          </Box>

          {/* Total values cards */}
          <Box>
            <Heading size="sm" color="gray.700" mb={4}>Total Values</Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Total capacity</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">{analytics.totalCapacity.toFixed(2)} kW</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Total quoted cost</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">₹{Math.round(analytics.totalQuoted).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Total expenditure</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">₹{Math.round(analytics.totalExp).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Total received</StatLabel>
                    <StatNumber fontSize="2xl" color="green.600">₹{Math.round(analytics.totalReceived).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Total pending</StatLabel>
                    <StatNumber fontSize="2xl" color="orange.600">₹{Math.round(analytics.totalPending).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Total profit now</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">₹{Math.round(analytics.totalProfitNow).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor="gray.100" shadow="sm">
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">Total profit</StatLabel>
                    <StatNumber fontSize="2xl" color="brand.600">₹{Math.round(analytics.totalOverallProfit).toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
            </SimpleGrid>
          </Box>

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
                      <FormLabel fontSize="sm">Transport Segment (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.transport_segment || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            transport_segment: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
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
                      <Input
                        type="number"
                        value={selectedProject.dept_charges || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            dept_charges: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Total Exp (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.total_exp || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            total_exp: parseFloat(e.target.value) || 0,
                          })
                        }
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
                        value={selectedProject.profit_right_now || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            profit_right_now: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Overall Profit (₹)</FormLabel>
                      <Input
                        type="number"
                        value={selectedProject.overall_profit || 0}
                        onChange={(e) =>
                          setSelectedProject({
                            ...selectedProject,
                            overall_profit: parseFloat(e.target.value) || 0,
                          })
                        }
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
