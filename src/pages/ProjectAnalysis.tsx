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
  created_at?: string;
  updated_at?: string;
}

const ProjectAnalysis = () => {
  const { isAuthenticated } = useAuth();
  const [projectData, setProjectData] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjectAnalysisData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fetchProjectAnalysisData = async () => {
    try {
      setIsLoading(true);

      // Fetch from project_analysis table
      const { data: analysisData, error: analysisError } = await supabase
        .from('project_analysis')
        .select('*')
        .order('sl_no', { ascending: true });

      if (analysisError && (analysisError as any)?.code !== 'PGRST116') {
        console.error('Analysis data error:', analysisError);
      }

      // If table doesn't exist or is empty, fetch from projects
      if (!analysisData || analysisData.length === 0) {
        const { data: projects, error: projectError } = await supabase
          .from('projects')
          .select('id, customer_name, phone as mobile_no, proposal_amount, kwh')
          .neq('status', 'deleted')
          .limit(50);

        if (projectError) {
          console.error('Project error:', projectError);
          throw projectError;
        }

        if (projects) {
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
          }));

          setProjectData(transformedProjects);
        }
      } else {
        setProjectData(analysisData);
      }
    } catch (error) {
      console.error('Error fetching project analysis:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch project analysis data',
        status: 'error',
        duration: 3,
        isClosable: true,
      });
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

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Project analysis updated successfully',
        status: 'success',
        duration: 3,
        isClosable: true,
      });

      fetchProjectAnalysisData();
      onClose();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        title: 'Error',
        description: 'Failed to save project analysis',
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

      if (error) throw error;

      setProjectData(projectData.filter((p) => p.id !== id));
      toast({
        title: 'Success',
        description: 'Project analysis deleted successfully',
        status: 'success',
        duration: 3,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete project analysis',
        status: 'error',
        duration: 3,
        isClosable: true,
      });
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="70vh">
        <VStack spacing={6}>
          <Text fontSize="6xl">📊</Text>
          <Text fontSize="lg" color="gray.600">
            Loading project analysis...
          </Text>
          <Progress size="md" isIndeterminate w="300px" colorScheme="brand" borderRadius="full" />
        </VStack>
      </Box>
    );
  }

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
          <Box>
            <Heading size="lg" color="gray.800" mb={2}>
              Project Analysis
            </Heading>
            <Text color="gray.600">
              Detailed cost and profit analysis for all projects
            </Text>
          </Box>
        </Flex>

        {/* Projects Table */}
        <Card bg={cardBg} shadow="sm" border="1px solid" borderColor="gray.100">
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Box>
                <Heading size="md" color="gray.800">
                  Project Details & Analysis
                </Heading>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  {projectData.length} projects with cost breakdown
                </Text>
              </Box>
            </Flex>
          </CardHeader>
          <CardBody pt={0} overflowX="auto">
            {projectData.length > 0 ? (
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
                  {projectData.map((project) => (
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
                <Text color="gray.400" fontSize="sm">
                  Projects will appear here once they are created
                </Text>
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

                {/* Editable fields */}
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
