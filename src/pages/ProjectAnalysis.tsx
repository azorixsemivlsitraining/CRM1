import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardHeader,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Input,
  Button,
  IconButton,
  Progress,
  Flex,
  useColorModeValue,
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
import { DeleteIcon } from '@chakra-ui/icons';
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

const ProjectAnalysis = () => {
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

  useEffect(() => {
    if (isAuthenticated && isAnalysisUnlocked) {
      checkAndInitializeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAnalysisUnlocked]);

  useEffect(() => {
    // Apply state filter to project data
    if (selectedFilter !== 'All' && projectData.length > 0) {
      const filtered = projectData.filter((project: any) => {
        const projectState = (project.state || '').toLowerCase();

        // Map filter codes to state names
        if (selectedFilter === 'TG') {
          return projectState.includes('telangana');
        } else if (selectedFilter === 'AP') {
          return projectState.includes('andhra') || projectState.includes('pradesh');
        } else if (selectedFilter === 'Chitoor') {
          return projectState === 'chitoor';
        }
        return false;
      });
      setFilteredData(filtered);
    } else {
      setFilteredData(projectData);
    }
  }, [selectedFilter, projectData]);

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
        .order('sl_no', { ascending: true });

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
          const transformedProjects: ProjectData[] = projects.map((project: any, index: number) => ({
            id: project.id,
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
            state: project.state || '',
          }));

          // Also fetch Chitoor projects for complete data
          const { data: chitoorProjects, error: chitoorError } = await supabase
            .from('chitoor_projects')
            .select('*');

          let allProjects = transformedProjects;

          if (!chitoorError && chitoorProjects && chitoorProjects.length > 0) {
            const chitoorTransformed: ProjectData[] = chitoorProjects.map((project: any, index: number) => ({
              id: project.id,
              sl_no: transformedProjects.length + index + 1,
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
            }));
            allProjects = [...transformedProjects, ...chitoorTransformed];
          }

          setProjectData(allProjects);
        } else {
          setProjectData([]);
        }
      } else {
        // If analysisData exists, check for Chitoor projects too
        const { data: chitoorProjects, error: chitoorError } = await supabase
          .from('chitoor_projects')
          .select('*');

        let allData = analysisData;

        if (!chitoorError && chitoorProjects && chitoorProjects.length > 0) {
          const chitoorTransformed: ProjectData[] = chitoorProjects.map((project: any, index: number) => ({
            id: project.id,
            sl_no: analysisData.length + index + 1,
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
          }));
          allData = [...analysisData, ...chitoorTransformed];
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

  const handleEditProject = (project: ProjectData) => {
    setSelectedProject(project);
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
          <Heading size="lg" color="gray.800" mb={4}>
            Project Analysis
          </Heading>
          <Text color="gray.600" mb={6}>
            {selectedFilter === 'All'
              ? 'Detailed cost and profit analysis for all projects'
              : `Detailed cost and profit analysis for ${selectedFilter} projects`
            }
          </Text>

          {/* Filter Buttons */}
          <HStack spacing={3} wrap="wrap">
            {(['All', 'TG', 'AP', 'Chitoor'] as const).map((filter) => (
              <Button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                colorScheme={selectedFilter === filter ? 'brand' : 'gray'}
                variant={selectedFilter === filter ? 'solid' : 'outline'}
                size="sm"
              >
                {filter}
              </Button>
            ))}
          </HStack>
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
                  {filteredData.length} {selectedFilter !== 'All' ? `${selectedFilter} ` : ''}projects with cost breakdown
                  {selectedFilter !== 'All' && projectData.length > 0 && (
                    <Text as="span" fontSize="xs" color="gray.500" ml={2}>
                      (out of {projectData.length} total)
                    </Text>
                  )}
                </Text>
              </Box>
            </Flex>
          </CardHeader>
          <CardBody pt={0} overflowX="auto">
            {filteredData.length > 0 ? (
              <Table variant="simple" size="sm">
                <Thead bg="gray.50">
                  <Tr>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">
                      SL No
                    </Th>
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
                  {filteredData.map((project) => (
                    <Tr key={project.id} _hover={{ bg: 'gray.50' }}>
                      <Td>
                        <Text fontSize="sm" fontWeight="medium">
                          {project.sl_no}
                        </Text>
                      </Td>
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
                  Projects will appear here once they are created in the Projects section
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
                        {(selectedProject.payment_dates || []).map((date, index) => (
                          <HStack key={index} spacing={2}>
                            <Input
                              type="date"
                              value={date || ''}
                              onChange={(e) => {
                                const updatedDates = [...(selectedProject.payment_dates || [])];
                                updatedDates[index] = e.target.value;
                                setSelectedProject({
                                  ...selectedProject,
                                  payment_dates: updatedDates,
                                });
                              }}
                            />
                            <IconButton
                              aria-label="Remove date"
                              icon={<DeleteIcon />}
                              size="sm"
                              colorScheme="red"
                              variant="ghost"
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
                        ))}
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
