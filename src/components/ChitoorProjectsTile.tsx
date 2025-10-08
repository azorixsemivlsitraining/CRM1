import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  LinkBox,
  LinkOverlay,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { ChevronDownIcon, RepeatIcon } from '@chakra-ui/icons';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatSupabaseError } from '../utils/error';

interface ChitoorProjectsTileProps {
  isMobile: boolean;
  cardBg: string;
  borderColor: string;
  titleColor: string;
  accentColor: string;
  onNavigateToFull: () => void;
  canApprove: boolean;
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type FilterKey = 'all' | ApprovalStatus;

interface ApprovalRecord {
  id: string;
  project_name: string | null;
  date: string | null;
  capacity_kw: number | null;
  location: string | null;
  power_bill_number: string | null;
  project_cost: number | null;
  site_visit_status: string | null;
  payment_amount: number | null;
  banking_ref_id: string | null;
  service_number: string | null;
  service_status: string | null;
  approval_status: string | null;
  approval_updated_at: string | null;
}

const statusLabels: Record<FilterKey, string> = {
  all: 'All',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const statusBadgeColors: Record<ApprovalStatus, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

const approvalEndpoint = process.env.REACT_APP_CRM_APPROVAL_ENDPOINT || '';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const dateFormatter = (value: string | null) => {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (error) {
    console.error('Date formatting error', error);
    return value;
  }
};

const ChitoorProjectsTile = ({
  isMobile,
  cardBg,
  borderColor,
  titleColor,
  accentColor,
  onNavigateToFull,
  canApprove,
}: ChitoorProjectsTileProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setApprovals([]);
      return;
    }

    try {
      setLoading(true);
      const res = await supabase
        .from('chitoor_project_approvals')
        .select('*')
        .order('created_at', { ascending: false });

      const data = res.data as ApprovalRecord[] | null;
      const error = res.error;

      if (error) {
        throw error;
      }

      setApprovals(data ?? []);
    } catch (error: any) {
      console.error('Failed to load Chitoor approvals', error);
      const message = formatSupabaseError(error) || error?.message || 'Unable to load Chitoor approvals.';
      toast({
        title: 'Chitoor approvals unavailable',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const summary = useMemo(() => {
    const base = { total: approvals.length, pending: 0, approved: 0, rejected: 0 };
    approvals.forEach((record) => {
      const status = (record.approval_status || 'pending').toLowerCase() as ApprovalStatus;
      if (status === 'approved') {
        base.approved += 1;
      } else if (status === 'rejected') {
        base.rejected += 1;
      } else {
        base.pending += 1;
      }
    });
    return base;
  }, [approvals]);

  const summaryByFilter: Record<FilterKey, number> = useMemo(
    () => ({
      all: summary.total,
      pending: summary.pending,
      approved: summary.approved,
      rejected: summary.rejected,
    }),
    [summary]
  );

  const displayedRecords = useMemo(() => {
    if (filter === 'all') {
      return approvals;
    }
    return approvals.filter((record) => (record.approval_status || 'pending').toLowerCase() === filter);
  }, [approvals, filter]);

  const latestRecord = approvals[0];
  const latestStatus = (latestRecord?.approval_status || 'pending').toLowerCase() as ApprovalStatus;

  const sendApprovalStatus = useCallback(
    async (recordId: string, status: ApprovalStatus) => {
      if (!approvalEndpoint) {
        throw new Error('Set REACT_APP_CRM_APPROVAL_ENDPOINT to allow approval updates.');
      }

      const response = await fetch(approvalEndpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: recordId, approval_status: status }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Approval sync failed.');
      }
    },
    []
  );

  const handleStatusChange = useCallback(
    async (recordId: string, status: ApprovalStatus) => {
      try {
        setUpdatingId(recordId);
        await sendApprovalStatus(recordId, status);
        toast({
          title: 'Approval status updated',
          description: `Chitoor project marked as ${statusLabels[status]}.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        await fetchApprovals();
      } catch (error: any) {
        console.error('Failed to update approval status', error);
        toast({
          title: 'Update failed',
          description: error?.message || 'Unable to update approval status.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchApprovals, sendApprovalStatus, toast]
  );

  const handleOpenDetails = useCallback(() => {
    if (!approvals.length) {
      fetchApprovals();
    }
    setFilter('all');
    onOpen();
  }, [approvals.length, fetchApprovals, onOpen]);

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
              🏗️
            </Text>
            <Heading size="sm" mb={1} color={accentColor}>
              Chitoor Projects
            </Heading>
            <Text fontSize="sm" color={titleColor}>
              Track district approvals with CRM sync
            </Text>
          </Box>
          <Button
            variant="outline"
            size="sm"
            colorScheme="green"
            onClick={onNavigateToFull}
          >
            View page
          </Button>
        </Flex>

        <SimpleGrid columns={2} spacing={3} mb={4}>
          <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={3}>
            <Text fontSize="xs" color="gray.500">
              Total
            </Text>
            <Heading size="md" color="gray.800">
              {summary.total}
            </Heading>
          </Box>
          <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={3}>
            <Text fontSize="xs" color="gray.500">
              Pending
            </Text>
            <Heading size="md" color="yellow.600">
              {summary.pending}
            </Heading>
          </Box>
          <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={3}>
            <Text fontSize="xs" color="gray.500">
              Approved
            </Text>
            <Heading size="md" color="green.600">
              {summary.approved}
            </Heading>
          </Box>
          <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={3}>
            <Text fontSize="xs" color="gray.500">
              Rejected
            </Text>
            <Heading size="md" color="red.500">
              {summary.rejected}
            </Heading>
          </Box>
        </SimpleGrid>

        <VStack spacing={1} align="start" mb={4}>
          <Text fontSize="xs" color="gray.500">
            Latest project
          </Text>
          {latestRecord ? (
            <Box>
              <Text fontWeight="medium" fontSize="sm" color="gray.800">
                {latestRecord.project_name || 'Project'}
              </Text>
              <HStack spacing={2} fontSize="xs" color="gray.500">
                <Text>{dateFormatter(latestRecord.date)}</Text>
                <Badge colorScheme={statusBadgeColors[latestStatus]}
                >
                  {statusLabels[latestStatus]}
                </Badge>
              </HStack>
            </Box>
          ) : (
            <Text fontSize="sm" color="gray.500">
              No Chitoor projects available yet.
            </Text>
          )}
        </VStack>

        <Box mt={3}>
          <LinkOverlay as="button" onClick={handleOpenDetails} color={accentColor}>
            Open approvals
          </LinkOverlay>
        </Box>
      </LinkBox>

      <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex justify="space-between" align="center" gap={4}>
              <Box>
                <Heading size="md" color="gray.800">
                  Chitoor project approvals
                </Heading>
                <Text fontSize="sm" color="gray.500">
                  Data shared via Supabase with CRM-controlled approvals
                </Text>
              </Box>
              <HStack spacing={3}>
                <Button
                  variant="outline"
                  colorScheme="green"
                  onClick={onNavigateToFull}
                >
                  Go to projects page
                </Button>
                <IconButton
                  aria-label="Refresh Chitoor approvals"
                  icon={<RepeatIcon />}
                  onClick={fetchApprovals}
                  isLoading={loading}
                  variant="ghost"
                />
              </HStack>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={6}>
              <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                {(['all', 'pending', 'approved', 'rejected'] as FilterKey[]).map((key) => (
                  <Box
                    key={key}
                    border="1px solid"
                    borderColor={filter === key ? 'green.200' : 'gray.200'}
                    borderRadius="lg"
                    p={4}
                    bg={filter === key ? 'green.50' : 'white'}
                    cursor="pointer"
                    onClick={() => setFilter(key)}
                    transition="all 0.2s"
                    _hover={{ borderColor: 'green.300' }}
                  >
                    <Text fontSize="xs" color="gray.500">
                      {statusLabels[key]}
                    </Text>
                    <Heading size="md" color="gray.800">
                      {summaryByFilter[key]}
                    </Heading>
                  </Box>
                ))}
              </SimpleGrid>

              <Box>
                <Flex justify="space-between" align="center" mb={3}>
                  <Heading size="sm" color="gray.700">
                    {statusLabels[filter]} projects
                  </Heading>
                  {loading && (
                    <HStack spacing={2} color="gray.500" fontSize="sm">
                      <Spinner size="sm" />
                      <Text>Loading approvals…</Text>
                    </HStack>
                  )}
                </Flex>

                <TableContainer border="1px solid" borderColor="gray.100" borderRadius="lg">
                  <Table variant="simple" size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th color="gray.600">Project</Th>
                        <Th color="gray.600">Date</Th>
                        <Th color="gray.600">Capacity (kW)</Th>
                        <Th color="gray.600">Location</Th>
                        <Th color="gray.600">Power Bill #</Th>
                        <Th color="gray.600">Cost</Th>
                        <Th color="gray.600">Site Visit</Th>
                        <Th color="gray.600">Payment</Th>
                        <Th color="gray.600">Approval</Th>
                        {canApprove && <Th color="gray.600">Actions</Th>}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {displayedRecords.length === 0 && !loading ? (
                        <Tr>
                          <Td colSpan={canApprove ? 10 : 9}>
                            <Text textAlign="center" color="gray.500" py={6}>
                              No records in this view.
                            </Text>
                          </Td>
                        </Tr>
                      ) : (
                        displayedRecords.map((record) => {
                          const status = (record.approval_status || 'pending').toLowerCase() as ApprovalStatus;
                          return (
                            <Tr key={record.id} _hover={{ bg: 'gray.50' }}>
                              <Td>
                                <VStack align="start" spacing={1}>
                                  <Text fontWeight="medium" color="gray.800">
                                    {record.project_name || '—'}
                                  </Text>
                                  <Text fontSize="xs" color="gray.500">
                                    Service #{record.service_number || '—'}
                                  </Text>
                                </VStack>
                              </Td>
                              <Td>{dateFormatter(record.date)}</Td>
                              <Td>{record.capacity_kw ?? '—'}</Td>
                              <Td textTransform="capitalize">{record.location || '—'}</Td>
                              <Td>{record.power_bill_number || '—'}</Td>
                              <Td>{record.project_cost != null ? currencyFormatter.format(record.project_cost) : '—'}</Td>
                              <Td>{record.site_visit_status || '—'}</Td>
                              <Td>{record.payment_amount != null ? currencyFormatter.format(record.payment_amount) : '—'}</Td>
                              <Td>
                                <Badge colorScheme={statusBadgeColors[status]} textTransform="capitalize">
                                  {status}
                                </Badge>
                              </Td>
                              {canApprove && (
                                <Td>
                                  <Menu>
                                    <MenuButton
                                      as={Button}
                                      rightIcon={<ChevronDownIcon />}
                                      size="sm"
                                      colorScheme="green"
                                      variant="outline"
                                      isLoading={updatingId === record.id}
                                    >
                                      Update
                                    </MenuButton>
                                    <MenuList>
                                      {( ['approved', 'pending', 'rejected'] as ApprovalStatus[] ).map((option) => (
                                        <MenuItem
                                          key={option}
                                          onClick={() => handleStatusChange(record.id, option)}
                                          isDisabled={option === status}
                                        >
                                          Mark as {statusLabels[option]}
                                        </MenuItem>
                                      ))}
                                    </MenuList>
                                  </Menu>
                                </Td>
                              )}
                            </Tr>
                          );
                        })
                      )}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Close
            </Button>
            <Button colorScheme="green" onClick={fetchApprovals}>
              Refresh data
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ChitoorProjectsTile;
