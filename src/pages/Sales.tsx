import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Flex,
  Button,
  useDisclosure,
  useToast,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  VStack,
  HStack,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Avatar,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, AddIcon } from '@chakra-ui/icons';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatSupabaseError } from '../utils/error';
import NavigationHeader from '../components/NavigationHeader';

interface SalesPerson {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
}

interface LeadSource {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface Lead {
  id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  location?: string;
  source_id?: string;
  assigned_to?: string;
  status: string;
  created_at: string;
  updated_at: string;
  source?: LeadSource;
  assigned_person?: SalesPerson;
}

interface PipelineStage {
  id: string;
  name: string;
  order_index: number;
  color: string;
}

interface LeadPipeline {
  id: string;
  lead_id: string;
  current_stage_id: string;
  call_notes?: string;
  call_response?: string;
  location_details?: string;
  site_visit_date?: string;
  site_visit_notes?: string;
  advance_payment_amount?: number;
  advance_payment_date?: string;
  created_at: string;
  updated_at: string;
}

const Sales: React.FC = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const titleColor = useColorModeValue('gray.700', 'gray.200');
  
  const toast = useToast();
  const { isOpen: isAddLeadOpen, onOpen: onAddLeadOpen, onClose: onAddLeadClose } = useDisclosure();
  const { isOpen: isAddPersonOpen, onOpen: onAddPersonOpen, onClose: onAddPersonClose } = useDisclosure();
  const { isOpen: isDetailsOpen, onOpen: onDetailsOpen, onClose: onDetailsClose } = useDisclosure();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [pipelines, setPipelines] = useState<LeadPipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [newLeadData, setNewLeadData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    location: '',
    source_id: '',
    assigned_to: '',
  });

  const [newPersonData, setNewPersonData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      setLoading(true);

      const [{ data: leadsData }, { data: personsData }, { data: sourcesData }, { data: stagesData }, { data: pipelinesData }] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('sales_persons').select('*').order('name'),
        supabase.from('lead_sources').select('*').order('name'),
        supabase.from('pipeline_stages').select('*').order('order_index'),
        supabase.from('lead_pipeline').select('*'),
      ]);

      setLeads(leadsData ?? []);
      setSalesPersons(personsData ?? []);
      setSources(sourcesData ?? []);
      setStages(stagesData ?? []);
      setPipelines(pipelinesData ?? []);
    } catch (error: any) {
      console.error('Failed to fetch sales data', error);
      toast({
        title: 'Failed to load sales data',
        description: formatSupabaseError(error),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddLead = async () => {
    if (!newLeadData.customer_name.trim()) {
      toast({ title: 'Please enter customer name', status: 'warning' });
      return;
    }

    try {
      const { data: leadData, error: leadError } = await supabase.from('leads').insert([newLeadData]).select();
      
      if (leadError) throw leadError;

      if (leadData && leadData.length > 0) {
        const leadId = leadData[0].id;
        const firstStageId = stages[0]?.id;

        if (firstStageId) {
          const { error: pipelineError } = await supabase.from('lead_pipeline').insert([
            {
              lead_id: leadId,
              current_stage_id: firstStageId,
            },
          ]);

          if (pipelineError) throw pipelineError;
        }
      }

      toast({ title: 'Lead added successfully', status: 'success', duration: 3000 });
      setNewLeadData({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        location: '',
        source_id: '',
        assigned_to: '',
      });
      onAddLeadClose();
      await fetchData();
    } catch (error: any) {
      console.error('Failed to add lead', error);
      toast({
        title: 'Failed to add lead',
        description: formatSupabaseError(error),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleAddPerson = async () => {
    if (!newPersonData.name.trim()) {
      toast({ title: 'Please enter person name', status: 'warning' });
      return;
    }

    try {
      const { error } = await supabase.from('sales_persons').insert([newPersonData]);
      
      if (error) throw error;

      toast({ title: 'Sales person added successfully', status: 'success', duration: 3000 });
      setNewPersonData({ name: '', email: '', phone: '' });
      onAddPersonClose();
      await fetchData();
    } catch (error: any) {
      console.error('Failed to add sales person', error);
      toast({
        title: 'Failed to add sales person',
        description: formatSupabaseError(error),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleAssignLead = async (leadId: string, personId: string) => {
    try {
      const { error } = await supabase.from('leads').update({ assigned_to: personId }).eq('id', leadId);
      
      if (error) throw error;

      toast({ title: 'Lead assigned successfully', status: 'success', duration: 3000 });
      await fetchData();
    } catch (error: any) {
      console.error('Failed to assign lead', error);
      toast({
        title: 'Failed to assign lead',
        description: formatSupabaseError(error),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleMoveStage = async (leadId: string, newStageId: string) => {
    try {
      const pipeline = pipelines.find((p) => p.lead_id === leadId);
      if (!pipeline) return;

      const { error } = await supabase.from('lead_pipeline').update({ current_stage_id: newStageId }).eq('id', pipeline.id);
      
      if (error) throw error;

      toast({ title: 'Lead moved to new stage', status: 'success', duration: 3000 });
      await fetchData();
    } catch (error: any) {
      console.error('Failed to move lead', error);
      toast({
        title: 'Failed to move lead',
        description: formatSupabaseError(error),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;

    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      
      if (error) throw error;

      toast({ title: 'Lead deleted successfully', status: 'success', duration: 3000 });
      await fetchData();
    } catch (error: any) {
      console.error('Failed to delete lead', error);
      toast({
        title: 'Failed to delete lead',
        description: formatSupabaseError(error),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const getSalesPerson = (personId: string | undefined) => {
    return salesPersons.find((p) => p.id === personId);
  };

  const getSource = (sourceId: string | undefined) => {
    return sources.find((s) => s.id === sourceId);
  };

  const getStage = (stageId: string | undefined) => {
    return stages.find((s) => s.id === stageId);
  };

  const getPipeline = (leadId: string) => {
    return pipelines.find((p) => p.lead_id === leadId);
  };

  const leadsByStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    stages.forEach((stage) => {
      map[stage.id] = [];
    });

    leads.forEach((lead) => {
      const pipeline = getPipeline(lead.id);
      if (pipeline && map[pipeline.current_stage_id]) {
        map[pipeline.current_stage_id].push(lead);
      }
    });

    return map;
  }, [leads, stages, pipelines]);

  const summaryStats = useMemo(() => {
    return {
      total: leads.length,
      assigned: leads.filter((l) => l.assigned_to).length,
      unassigned: leads.filter((l) => !l.assigned_to).length,
      salesPersons: salesPersons.length,
    };
  }, [leads, salesPersons]);

  if (!isSupabaseConfigured) {
    return (
      <Box p={6}>
        <NavigationHeader title="Sales Pipeline" />
        <Box bg="yellow.50" border="1px solid" borderColor="yellow.200" borderRadius="md" p={4} mt={4}>
          <Text color="yellow.800">Supabase is not configured. Please set up your environment variables.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box px={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }} maxW="1400px" mx="auto">
      <NavigationHeader title="Sales Pipeline" />

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} my={6}>
        <Card bg={cardBg}>
          <CardBody>
            <Text fontSize="sm" color={titleColor}>Total Leads</Text>
            <Heading size="lg" color="green.600">{summaryStats.total}</Heading>
          </CardBody>
        </Card>
        <Card bg={cardBg}>
          <CardBody>
            <Text fontSize="sm" color={titleColor}>Assigned</Text>
            <Heading size="lg" color="blue.600">{summaryStats.assigned}</Heading>
          </CardBody>
        </Card>
        <Card bg={cardBg}>
          <CardBody>
            <Text fontSize="sm" color={titleColor}>Unassigned</Text>
            <Heading size="lg" color="orange.600">{summaryStats.unassigned}</Heading>
          </CardBody>
        </Card>
        <Card bg={cardBg}>
          <CardBody>
            <Text fontSize="sm" color={titleColor}>Sales Persons</Text>
            <Heading size="lg" color="purple.600">{summaryStats.salesPersons}</Heading>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Action Buttons */}
      <Flex gap={3} mb={6}>
        <Button leftIcon={<AddIcon />} colorScheme="green" onClick={onAddLeadOpen}>
          Add Lead
        </Button>
        <Button leftIcon={<AddIcon />} colorScheme="purple" variant="outline" onClick={onAddPersonOpen}>
          Add Sales Person
        </Button>
      </Flex>

      {/* Tabs for different views */}
      <Tabs isLazy>
        <TabList>
          <Tab>Pipeline View</Tab>
          <Tab>Lead List</Tab>
          <Tab>Sales Persons</Tab>
        </TabList>

        <TabPanels>
          {/* Pipeline View */}
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2, lg: stages.length > 4 ? 4 : stages.length }} spacing={4}>
              {stages.map((stage) => (
                <Box key={stage.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
                  <Heading size="sm" color="green.600" mb={4}>
                    {stage.name}
                  </Heading>
                  <VStack spacing={3} align="stretch">
                    {leadsByStage[stage.id]?.map((lead) => {
                      const person = getSalesPerson(lead.assigned_to);
                      const source = getSource(lead.source_id);
                      return (
                        <Card key={lead.id} size="sm" bg={cardBg} borderColor={borderColor} border="1px solid" cursor="pointer" _hover={{ shadow: 'md' }}>
                          <CardBody>
                            <VStack align="start" spacing={2}>
                              <Heading size="xs">{lead.customer_name}</Heading>
                              {source && <Badge fontSize="xs">{source.icon} {source.name}</Badge>}
                              {person ? (
                                <HStack spacing={2} fontSize="xs">
                                  <Avatar size="xs" name={person.name} />
                                  <Text>{person.name}</Text>
                                </HStack>
                              ) : (
                                <Text fontSize="xs" color="orange.600">Unassigned</Text>
                              )}
                              {lead.customer_phone && <Text fontSize="xs" color={titleColor}>{lead.customer_phone}</Text>}
                              {lead.location && <Text fontSize="xs" color={titleColor}>{lead.location}</Text>}
                              <HStack spacing={2} mt={2}>
                                <Menu>
                                  <MenuButton as={Button} size="xs" variant="outline">
                                    Move
                                  </MenuButton>
                                  <MenuList>
                                    {stages
                                      .filter((s) => s.id !== stage.id)
                                      .map((s) => (
                                        <MenuItem key={s.id} onClick={() => handleMoveStage(lead.id, s.id)}>
                                          {s.name}
                                        </MenuItem>
                                      ))}
                                  </MenuList>
                                </Menu>
                                <Menu>
                                  <MenuButton as={Button} size="xs" variant="outline">
                                    Assign
                                  </MenuButton>
                                  <MenuList>
                                    {salesPersons.map((person) => (
                                      <MenuItem key={person.id} onClick={() => handleAssignLead(lead.id, person.id)}>
                                        {person.name}
                                      </MenuItem>
                                    ))}
                                  </MenuList>
                                </Menu>
                                <IconButton
                                  aria-label="View details"
                                  icon={<EditIcon />}
                                  size="xs"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedLead(lead);
                                    onDetailsOpen();
                                  }}
                                />
                                <IconButton
                                  aria-label="Delete"
                                  icon={<DeleteIcon />}
                                  size="xs"
                                  colorScheme="red"
                                  variant="outline"
                                  onClick={() => handleDeleteLead(lead.id)}
                                />
                              </HStack>
                            </VStack>
                          </CardBody>
                        </Card>
                      );
                    })}
                    {!leadsByStage[stage.id] || leadsByStage[stage.id].length === 0 ? (
                      <Text fontSize="sm" color="gray.400" textAlign="center" py={4}>
                        No leads
                      </Text>
                    ) : null}
                  </VStack>
                </Box>
              ))}
            </SimpleGrid>
          </TabPanel>

          {/* Lead List View */}
          <TabPanel>
            {loading ? (
              <Flex justify="center" p={6}>
                <Spinner />
              </Flex>
            ) : (
              <TableContainer border="1px solid" borderColor={borderColor} borderRadius="lg">
                <Table variant="simple" size="sm">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th>Customer Name</Th>
                      <Th>Phone</Th>
                      <Th>Location</Th>
                      <Th>Source</Th>
                      <Th>Assigned To</Th>
                      <Th>Current Stage</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {leads.map((lead) => {
                      const person = getSalesPerson(lead.assigned_to);
                      const source = getSource(lead.source_id);
                      const pipeline = getPipeline(lead.id);
                      const stage = getStage(pipeline?.current_stage_id);

                      return (
                        <Tr key={lead.id}>
                          <Td fontWeight="medium">{lead.customer_name}</Td>
                          <Td>{lead.customer_phone || '—'}</Td>
                          <Td>{lead.location || '—'}</Td>
                          <Td>{source ? `${source.icon} ${source.name}` : '—'}</Td>
                          <Td>{person ? person.name : <Badge colorScheme="orange">Unassigned</Badge>}</Td>
                          <Td>{stage ? <Badge colorScheme="green">{stage.name}</Badge> : '—'}</Td>
                          <Td>
                            <HStack spacing={2}>
                              <IconButton
                                aria-label="View details"
                                icon={<EditIcon />}
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  onDetailsOpen();
                                }}
                              />
                              <IconButton
                                aria-label="Delete"
                                icon={<DeleteIcon />}
                                size="xs"
                                colorScheme="red"
                                variant="ghost"
                                onClick={() => handleDeleteLead(lead.id)}
                              />
                            </HStack>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Sales Persons View */}
          <TabPanel>
            <TableContainer border="1px solid" borderColor={borderColor} borderRadius="lg">
              <Table variant="simple" size="sm">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Phone</Th>
                    <Th>Leads Assigned</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {salesPersons.map((person) => {
                    const assignedLeads = leads.filter((l) => l.assigned_to === person.id);
                    return (
                      <Tr key={person.id}>
                        <Td fontWeight="medium">{person.name}</Td>
                        <Td>{person.email || '—'}</Td>
                        <Td>{person.phone || '—'}</Td>
                        <Td>{assignedLeads.length}</Td>
                        <Td>
                          <Badge colorScheme={person.status === 'active' ? 'green' : 'red'}>
                            {person.status}
                          </Badge>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Add Lead Modal */}
      <Modal isOpen={isAddLeadOpen} onClose={onAddLeadClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Lead</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Customer Name</FormLabel>
                <Input
                  placeholder="Enter customer name"
                  value={newLeadData.customer_name}
                  onChange={(e) => setNewLeadData({ ...newLeadData, customer_name: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Phone</FormLabel>
                <Input
                  placeholder="Enter phone number"
                  value={newLeadData.customer_phone}
                  onChange={(e) => setNewLeadData({ ...newLeadData, customer_phone: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input
                  placeholder="Enter email"
                  type="email"
                  value={newLeadData.customer_email}
                  onChange={(e) => setNewLeadData({ ...newLeadData, customer_email: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Location</FormLabel>
                <Input
                  placeholder="Enter location"
                  value={newLeadData.location}
                  onChange={(e) => setNewLeadData({ ...newLeadData, location: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Lead Source</FormLabel>
                <Select
                  value={newLeadData.source_id}
                  onChange={(e) => setNewLeadData({ ...newLeadData, source_id: e.target.value })}
                >
                  <option value="">Select source</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.icon} {source.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Assign To Sales Person</FormLabel>
                <Select
                  value={newLeadData.assigned_to}
                  onChange={(e) => setNewLeadData({ ...newLeadData, assigned_to: e.target.value })}
                >
                  <option value="">Select sales person</option>
                  {salesPersons.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onAddLeadClose}>
              Cancel
            </Button>
            <Button colorScheme="green" onClick={handleAddLead}>
              Add Lead
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Sales Person Modal */}
      <Modal isOpen={isAddPersonOpen} onClose={onAddPersonClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Sales Person</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input
                  placeholder="Enter name"
                  value={newPersonData.name}
                  onChange={(e) => setNewPersonData({ ...newPersonData, name: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input
                  placeholder="Enter email"
                  type="email"
                  value={newPersonData.email}
                  onChange={(e) => setNewPersonData({ ...newPersonData, email: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Phone</FormLabel>
                <Input
                  placeholder="Enter phone"
                  value={newPersonData.phone}
                  onChange={(e) => setNewPersonData({ ...newPersonData, phone: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onAddPersonClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handleAddPerson}>
              Add Person
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Lead Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Lead Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedLead && (
              <VStack spacing={4} align="start">
                <Box>
                  <Text fontSize="sm" color="gray.500">Customer Name</Text>
                  <Text fontWeight="medium">{selectedLead.customer_name}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.500">Phone</Text>
                  <Text fontWeight="medium">{selectedLead.customer_phone || '—'}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.500">Email</Text>
                  <Text fontWeight="medium">{selectedLead.customer_email || '—'}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.500">Location</Text>
                  <Text fontWeight="medium">{selectedLead.location || '—'}</Text>
                </Box>
                {(() => {
                  const source = getSource(selectedLead.source_id);
                  return source ? (
                    <Box>
                      <Text fontSize="sm" color="gray.500">Lead Source</Text>
                      <Text fontWeight="medium">{source.icon} {source.name}</Text>
                    </Box>
                  ) : null;
                })()}
                {(() => {
                  const person = getSalesPerson(selectedLead.assigned_to);
                  return (
                    <Box>
                      <Text fontSize="sm" color="gray.500">Assigned To</Text>
                      <Text fontWeight="medium">{person ? person.name : 'Unassigned'}</Text>
                    </Box>
                  );
                })()}
                {(() => {
                  const pipeline = getPipeline(selectedLead.id);
                  const stage = getStage(pipeline?.current_stage_id);
                  return stage ? (
                    <Box>
                      <Text fontSize="sm" color="gray.500">Current Stage</Text>
                      <Badge colorScheme="green">{stage.name}</Badge>
                    </Box>
                  ) : null;
                })()}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="green" onClick={onDetailsClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Sales;
