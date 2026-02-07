import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  LinkBox,
  LinkOverlay,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  VStack,
  Card,
  CardBody,
  Text,
  Avatar,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@chakra-ui/react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SalesTileProps {
  isMobile: boolean;
  cardBg: string;
  borderColor: string;
  titleColor: string;
  accentColor: string;
  onNavigateToFull: () => void;
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
}

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
  created_at: string;
  updated_at: string;
}

const SalesTile: React.FC<SalesTileProps> = ({
  isMobile,
  cardBg,
  borderColor,
  titleColor,
  accentColor,
  onNavigateToFull,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [pipelines, setPipelines] = useState<LeadPipeline[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLeads([]);
      setSalesPersons([]);
      setSources([]);
      setStages([]);
      setPipelines([]);
      return;
    }

    try {
      setLoading(true);

      const [{ data: leadsData }, { data: personsData }, { data: sourcesData }, { data: stagesData }, { data: pipelinesData }] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(100),
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
      console.warn('Failed to fetch sales data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (isSupabaseConfigured) {
      const leadsChannel = (supabase as any)
        .channel('realtime-leads')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
          fetchData();
        })
        .subscribe();

      const pipelineChannel = (supabase as any)
        .channel('realtime-lead-pipeline')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_pipeline' }, () => {
          fetchData();
        })
        .subscribe();

      return () => {
        try { (leadsChannel as any)?.unsubscribe?.(); } catch {}
        try { (pipelineChannel as any)?.unsubscribe?.(); } catch {}
      };
    }
  }, [fetchData]);

  const summary = useMemo(() => {
    const stageMap: Record<string, number> = {};
    stages.forEach((stage) => {
      stageMap[stage.id] = 0;
    });

    pipelines.forEach((pipeline) => {
      if (stageMap.hasOwnProperty(pipeline.current_stage_id)) {
        stageMap[pipeline.current_stage_id]++;
      }
    });

    return {
      total: leads.length,
      assigned: leads.filter((l) => l.assigned_to).length,
      unassigned: leads.filter((l) => !l.assigned_to).length,
      salesPersons: salesPersons.length,
      byStage: stageMap,
    };
  }, [leads, salesPersons, stages, pipelines]);

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

  const recentLeads = useMemo(() => {
    return leads.slice(0, 5);
  }, [leads]);

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
  }, [leads, stages, pipelines, getPipeline]);

  return (
    <>
      <LinkBox
        as="article"
        role="group"
        minW={isMobile ? '260px' : undefined}
        maxW={isMobile ? '260px' : undefined}
        bg={cardBg}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        p={isMobile ? 5 : 6}
        boxShadow="sm"
        transition="all 0.2s"
        _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }}
      >
        <Flex justify="space-between" align="flex-start" gap={4} mb={2}>
          <Box>
            <Text fontSize={isMobile ? '3xl' : '4xl'} mb={2}>
              💼
            </Text>
            <Heading size="sm" mb={1} color={accentColor}>
              Sales Pipeline
            </Heading>
            <Text fontSize="sm" color={titleColor}>
              Manage leads and track sales progress
            </Text>
          </Box>
        </Flex>

        <Box mt={3}>
          <LinkOverlay as="button" onClick={onOpen} color={accentColor}>
            Open
          </LinkOverlay>
        </Box>
      </LinkBox>

      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex justify="space-between" align="center" gap={4}>
              <HStack spacing={3} align="center">
                <Button variant="ghost" onClick={onClose}>
                  Back
                </Button>
                <Box>
                  <Heading size="md" color="gray.800">
                    Sales Pipeline
                  </Heading>
                  <Text fontSize="sm" color="gray.500">
                    Manage leads, pipeline stages, and sales persons
                  </Text>
                </Box>
              </HStack>
              <Button colorScheme="green" onClick={onNavigateToFull}>
                Go to Sales Page
              </Button>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Tabs>
              <TabList>
                <Tab>Overview</Tab>
                <Tab>Recent Leads</Tab>
                <Tab>Pipeline</Tab>
                <Tab>Sales Team</Tab>
              </TabList>

              <TabPanels>
                {/* Overview */}
                <TabPanel>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={6}>
                    <Card bg={cardBg}>
                      <CardBody>
                        <Text fontSize="sm" color={titleColor}>
                          Total Leads
                        </Text>
                        <Heading size="lg" color="green.600">
                          {summary.total}
                        </Heading>
                      </CardBody>
                    </Card>
                    <Card bg={cardBg}>
                      <CardBody>
                        <Text fontSize="sm" color={titleColor}>
                          Assigned
                        </Text>
                        <Heading size="lg" color="blue.600">
                          {summary.assigned}
                        </Heading>
                      </CardBody>
                    </Card>
                    <Card bg={cardBg}>
                      <CardBody>
                        <Text fontSize="sm" color={titleColor}>
                          Unassigned
                        </Text>
                        <Heading size="lg" color="orange.600">
                          {summary.unassigned}
                        </Heading>
                      </CardBody>
                    </Card>
                    <Card bg={cardBg}>
                      <CardBody>
                        <Text fontSize="sm" color={titleColor}>
                          Sales Persons
                        </Text>
                        <Heading size="lg" color="purple.600">
                          {summary.salesPersons}
                        </Heading>
                      </CardBody>
                    </Card>
                  </SimpleGrid>

                  <Text fontSize="sm" color={titleColor} mb={4} fontWeight="semibold">
                    Leads by Pipeline Stage
                  </Text>
                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                    {stages.map((stage) => (
                      <Card key={stage.id} bg={cardBg} border="1px solid" borderColor={borderColor}>
                        <CardBody>
                          <Text fontSize="xs" color={titleColor}>
                            {stage.name}
                          </Text>
                          <Heading size="sm" color="green.600">
                            {summary.byStage[stage.id] || 0}
                          </Heading>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                </TabPanel>

                {/* Recent Leads */}
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
                            <Th>Source</Th>
                            <Th>Assigned To</Th>
                            <Th>Stage</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {recentLeads.length === 0 ? (
                            <Tr>
                              <Td colSpan={5}>
                                <Text textAlign="center" color="gray.500" py={6}>
                                  No leads available.
                                </Text>
                              </Td>
                            </Tr>
                          ) : (
                            recentLeads.map((lead) => {
                              const person = getSalesPerson(lead.assigned_to);
                              const source = getSource(lead.source_id);
                              const pipeline = getPipeline(lead.id);
                              const stage = getStage(pipeline?.current_stage_id);

                              return (
                                <Tr key={lead.id}>
                                  <Td fontWeight="medium">{lead.customer_name}</Td>
                                  <Td fontSize="sm">{lead.customer_phone || '—'}</Td>
                                  <Td fontSize="sm">{source ? `${source.icon} ${source.name}` : '—'}</Td>
                                  <Td fontSize="sm">
                                    {person ? (
                                      <HStack spacing={2}>
                                        <Avatar size="xs" name={person.name} />
                                        <Text>{person.name}</Text>
                                      </HStack>
                                    ) : (
                                      <Badge colorScheme="orange">Unassigned</Badge>
                                    )}
                                  </Td>
                                  <Td>
                                    <Badge colorScheme="green">{stage?.name || '—'}</Badge>
                                  </Td>
                                </Tr>
                              );
                            })
                          )}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  )}
                </TabPanel>

                {/* Pipeline */}
                <TabPanel>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: stages.length > 4 ? 4 : stages.length }} spacing={4}>
                    {stages.map((stage) => (
                      <Box key={stage.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" p={4}>
                        <Heading size="sm" color="green.600" mb={3}>
                          {stage.name}
                        </Heading>
                        <VStack spacing={2} align="stretch">
                          {(leadsByStage[stage.id] || []).slice(0, 3).map((lead) => {
                            const person = getSalesPerson(lead.assigned_to);
                            return (
                              <Card key={lead.id} size="sm" bg={cardBg} borderColor={borderColor} border="1px solid">
                                <CardBody>
                                  <VStack align="start" spacing={1}>
                                    <Heading size="xs">{lead.customer_name}</Heading>
                                    {person ? (
                                      <HStack spacing={2} fontSize="xs">
                                        <Avatar size="xs" name={person.name} />
                                        <Text>{person.name}</Text>
                                      </HStack>
                                    ) : (
                                      <Text fontSize="xs" color="orange.600">
                                        Unassigned
                                      </Text>
                                    )}
                                  </VStack>
                                </CardBody>
                              </Card>
                            );
                          })}
                          {(leadsByStage[stage.id]?.length || 0) > 3 && (
                            <Text fontSize="xs" color="gray.500" textAlign="center">
                              +{(leadsByStage[stage.id]?.length || 0) - 3} more
                            </Text>
                          )}
                          {(!leadsByStage[stage.id] || leadsByStage[stage.id].length === 0) && (
                            <Text fontSize="xs" color="gray.400" textAlign="center">
                              No leads
                            </Text>
                          )}
                        </VStack>
                      </Box>
                    ))}
                  </SimpleGrid>
                </TabPanel>

                {/* Sales Team */}
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
                        {salesPersons.length === 0 ? (
                          <Tr>
                            <Td colSpan={5}>
                              <Text textAlign="center" color="gray.500" py={6}>
                                No sales persons added yet.
                              </Text>
                            </Td>
                          </Tr>
                        ) : (
                          salesPersons.map((person) => {
                            const assignedLeads = leads.filter((l) => l.assigned_to === person.id);
                            return (
                              <Tr key={person.id}>
                                <Td fontWeight="medium">{person.name}</Td>
                                <Td fontSize="sm">{person.email || '—'}</Td>
                                <Td fontSize="sm">{person.phone || '—'}</Td>
                                <Td fontSize="sm" fontWeight="medium">
                                  {assignedLeads.length}
                                </Td>
                                <Td>
                                  <Badge colorScheme={person.status === 'active' ? 'green' : 'red'}>
                                    {person.status}
                                  </Badge>
                                </Td>
                              </Tr>
                            );
                          })
                        )}
                      </Tbody>
                    </Table>
                  </TableContainer>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Close
            </Button>
            <Button colorScheme="green" onClick={onNavigateToFull}>
              Go to Sales Page
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default SalesTile;
