import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Text,
  Button,
  VStack,
  HStack,
  Flex,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  FormControl,
  FormLabel,
  useDisclosure,
  Card,
  CardHeader,
  CardBody,
  SimpleGrid,
  useToast,
  TableContainer,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  ModalCloseButton,
  Select,
  Divider,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';
import { formatSupabaseError } from '../utils/error';
import { CHITOOR_PROJECT_STAGES } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import { ArrowBackIcon, EditIcon, CalendarIcon } from '@chakra-ui/icons';
import { generatePaymentReceiptPDF } from './PaymentReceipt';

interface ChitoorProject {
  id: string;
  customer_name: string;
  mobile_number: string;
  date_of_order: string;
  service_number?: string;
  address_mandal_village: string;
  capacity: number;
  project_cost: number;
  amount_received?: number;
  subsidy_scope?: string;
  velugu_officer_payments?: number;
  project_status?: string;
  material_sent_date?: string;
  balamuragan_payment?: number;
  created_at?: string;
}

interface PaymentHistory {
  id: string;
  amount: number;
  payment_date: string;
  payment_mode?: string;
  created_at: string;
}

const ChitoorProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const { isOpen: isPaymentOpen, onOpen: onPaymentOpen, onClose: onPaymentClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isCustomerEditOpen, onOpen: onCustomerEditOpen, onClose: onCustomerEditClose } = useDisclosure();
  
  const [project, setProject] = useState<ChitoorProject | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [paymentsTable, setPaymentsTable] = useState<'payment_history' | 'chitoor_payment_history'>('payment_history');
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    customer_name: '',
    mobile_number: '',
    address_mandal_village: '',
    service_number: '',
  });

  const [projectFormData, setProjectFormData] = useState({
    capacity: 0,
    project_cost: 0,
    subsidy_scope: '',
    material_sent_date: '',
    project_status: '' as string | undefined,
  });

  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const edit = params.get('edit');
    if (edit === 'customer') {
      onCustomerEditOpen();
    } else if (edit === 'project') {
      onEditOpen();
    }
  }, [location.search]);

  const fetchProjectDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('chitoor_projects')
        .select('*')
        .eq('id', id)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
        toast({
          title: 'Error',
          description: `Failed to fetch project details. ${formatSupabaseError(projectError)}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      if (projectData) {
        setProject(projectData);
        setCustomerFormData({
          customer_name: projectData.customer_name || '',
          mobile_number: projectData.mobile_number || '',
          address_mandal_village: projectData.address_mandal_village || '',
          service_number: projectData.service_number || '',
        });
        setProjectFormData({
          capacity: Number(projectData.capacity) || 0,
          project_cost: Number(projectData.project_cost) || 0,
          subsidy_scope: projectData.subsidy_scope || '',
          material_sent_date: projectData.material_sent_date ? new Date(projectData.material_sent_date).toISOString().split('T')[0] : '',
          project_status: projectData.project_status || 'Pending',
        });
      }

      // Fetch phase-wise payment history. Try shared table first, then chitoor-specific as fallback
      let localPayments: any[] = [];
      let usedTable: 'payment_history' | 'chitoor_payment_history' = 'payment_history';
      let projectIdField: 'project_id' | 'chitoor_project_id' = 'project_id';

      try {
        const { data: payData } = await supabase
          .from('payment_history')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: true });
        localPayments = (payData as any[]) || [];
      } catch (firstErr) {
        // ignore and try fallback
      }

      if ((!localPayments || localPayments.length === 0)) {
        try {
          const { data: chPayData } = await supabase
            .from('chitoor_payment_history')
            .select('*')
            .eq('chitoor_project_id', id)
            .order('created_at', { ascending: true });
          if (chPayData && Array.isArray(chPayData)) {
            localPayments = chPayData as any[];
            usedTable = 'chitoor_payment_history';
            projectIdField = 'chitoor_project_id';
          }
        } catch (secondErr) {
          console.warn('Payment history fallback failed', secondErr);
        }
      }

      setPaymentsTable(usedTable);
      if ((!localPayments || localPayments.length === 0) && projectData?.amount_received && projectData.amount_received > 0) {
        const d = projectData.date_of_order || projectData.created_at || new Date().toISOString();
        setPaymentHistory([
          {
            id: 'initial',
            amount: projectData.amount_received,
            payment_date: d,
            payment_mode: 'Cash',
            created_at: d,
          },
        ]);
      } else {
        setPaymentHistory(localPayments as PaymentHistory[]);
      }

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  const handleAddPayment = async () => {
    if (!paymentAmount || !project) return;

    try {
      setProcessingPayment(true);

      // Validate amount
      const amountNum = Number(paymentAmount);
      if (!isFinite(amountNum) || amountNum <= 0) {
        toast({ title: 'Invalid amount', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      const maxPayable = Math.max((project.project_cost || 0) - (project.amount_received || 0), 0);
      if (amountNum > maxPayable) {
        toast({ title: 'Amount exceeds balance', description: `Max: ₹${maxPayable.toLocaleString()}`, status: 'warning', duration: 4000, isClosable: true });
        return;
      }
      if (!paymentDate) {
        toast({ title: 'Choose a payment date', status: 'warning', duration: 3000, isClosable: true });
        return;
      }

      // Insert a new phase entry into detected table; fallback to chitoor_payment_history on FK error
      let usedTable: 'payment_history' | 'chitoor_payment_history' = paymentsTable;
      let projectIdField: 'project_id' | 'chitoor_project_id' = usedTable === 'payment_history' ? 'project_id' : 'chitoor_project_id';

      let insertError: any | null = null;
      try {
        const { error } = await supabase
          .from(usedTable)
          .insert([{
            [projectIdField]: project.id,
            amount: amountNum,
            payment_mode: paymentMode,
            payment_date: paymentDate,
          } as any]);
        insertError = error || null;
      } catch (e) {
        insertError = e;
      }

      if (insertError) {
        usedTable = 'chitoor_payment_history';
        projectIdField = 'chitoor_project_id';
        const { error: fbError } = await supabase
          .from(usedTable)
          .insert([{
            [projectIdField]: project.id,
            amount: amountNum,
            payment_mode: paymentMode,
            payment_date: paymentDate,
          } as any]);
        if (fbError) throw fbError;
        setPaymentsTable(usedTable);
      }

      const newAmountReceived = (project.amount_received || 0) + amountNum;

      // Update project with new amount received
      const { error: updateError } = await supabase
        .from('chitoor_projects')
        .update({ amount_received: newAmountReceived })
        .eq('id', project.id);

      if (updateError) throw updateError;

      // Refresh payments from the detected table
      const tableToRead = usedTable;
      const projectField = usedTable === 'payment_history' ? 'project_id' : 'chitoor_project_id';
      const { data: payData } = await supabase
        .from(tableToRead)
        .select('*')
        .eq(projectField, project.id)
        .order('created_at', { ascending: true });
      setPaymentHistory((payData as any[]) as PaymentHistory[]);
      setProject(prev => prev ? { ...prev, amount_received: newAmountReceived } : null);

      toast({
        title: 'Success',
        description: 'Payment added successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      onPaymentClose();
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('Cash');

    } catch (error: any) {
      console.error('Error adding payment:', error);
      const message = formatSupabaseError(error) || (error?.message || 'Failed to add payment');
      toast({
        title: 'Error adding payment',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleDeletePayment = async (payment: PaymentHistory) => {
    if (!project) return;
    try {
      // Delete payment row
      const tableToUse = paymentsTable;
      const { error: delError } = await supabase
        .from(tableToUse)
        .delete()
        .eq('id', payment.id);
      if (delError) throw delError;

      const updatedAmount = Math.max((project.amount_received || 0) - (payment.amount || 0), 0);
      const { error: updError } = await supabase
        .from('chitoor_projects')
        .update({ amount_received: updatedAmount })
        .eq('id', project.id);
      if (updError) throw updError;

      // Refresh list
      const projectField = tableToUse === 'payment_history' ? 'project_id' : 'chitoor_project_id';
      const { data: payData } = await supabase
        .from(tableToUse)
        .select('*')
        .eq(projectField, project.id)
        .order('created_at', { ascending: true });

      setPaymentHistory((payData as any[]) as PaymentHistory[]);
      setProject(prev => prev ? { ...prev, amount_received: updatedAmount } : null);

      toast({
        title: 'Payment deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error('Error deleting payment:', err);
      toast({
        title: 'Error',
        description: formatSupabaseError(err) || 'Failed to delete payment',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'green';
      case 'installation completed': return 'green';
      case 'pending': return 'yellow';
      case 'material pending': return 'yellow';
      case 'in progress': return 'blue';
      case 'material sent': return 'purple';
      case 'on hold': return 'red';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <Box p={8} textAlign="center">
        <Text>Loading project details...</Text>
      </Box>
    );
  }

  if (!project) {
    return (
      <Box p={8} textAlign="center">
        <Text>Project not found</Text>
        <Button mt={4} onClick={() => navigate('/projects/chitoor')}>
          Back to Chitoor Projects
        </Button>
      </Box>
    );
  }

  const balanceAmount = (project.project_cost || 0) - (project.amount_received || 0);

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <HStack spacing={4}>
            <IconButton
              icon={<ArrowBackIcon />}
              onClick={() => navigate('/projects/chitoor')}
              variant="ghost"
              aria-label="Back to projects"
            />
            <Box>
              <Text fontSize="2xl" fontWeight="bold" color="gray.800">
                Chitoor Project Details
              </Text>
              <Text color="gray.600">
                Project ID: {project.id}
              </Text>
            </Box>
          </HStack>
          <HStack spacing={2}>
            <Tooltip label="Edit customer" hasArrow>
              <IconButton aria-label="Edit customer" icon={<EditIcon />} variant="ghost" onClick={onCustomerEditOpen} />
            </Tooltip>
            <Tooltip label="Edit project" hasArrow>
              <IconButton aria-label="Edit project" icon={<EditIcon />} variant="ghost" onClick={onEditOpen} />
            </Tooltip>
            <Button leftIcon={<CalendarIcon />} colorScheme="blue" onClick={onPaymentOpen}>
              Add Payment
            </Button>
          </HStack>
        </Flex>

        {/* Project Info Cards */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          {/* Customer Details */}
          <Card>
            <CardHeader>
              <Flex justify="space-between" align="center">
                <Text fontSize="lg" fontWeight="semibold" color="gray.700">
                  Customer Details
                </Text>
                <Tooltip label="Edit customer" hasArrow>
                  <IconButton aria-label="Edit customer" icon={<EditIcon />} variant="ghost" size="sm" onClick={onCustomerEditOpen} />
                </Tooltip>
              </Flex>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={3}>
                <Text><strong>Name:</strong> {project.customer_name}</Text>
                <Text><strong>Phone:</strong> {project.mobile_number}</Text>
                <Text><strong>Address:</strong> {project.address_mandal_village}</Text>
                {project.service_number && (
                  <Text><strong>Service Number:</strong> {project.service_number}</Text>
                )}
                <Text><strong>Order Date:</strong> {project.date_of_order ? new Date(project.date_of_order).toLocaleDateString() : 'N/A'}</Text>
              </VStack>
            </CardBody>
          </Card>

          {/* Project Details */}
          <Card>
            <CardHeader>
              <Flex justify="space-between" align="center">
                <Text fontSize="lg" fontWeight="semibold" color="gray.700">
                  Project Details
                </Text>
                <Tooltip label="Edit project" hasArrow>
                  <IconButton aria-label="Edit project" icon={<EditIcon />} variant="ghost" size="sm" onClick={onEditOpen} />
                </Tooltip>
              </Flex>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={3}>
                <Text><strong>Project Name:</strong> Chitoor-{project.id.slice(-6)}</Text>
                <HStack>
                  <Text><strong>Status:</strong></Text>
                  <Badge 
                    colorScheme={getStatusColor(project.project_status || 'pending')}
                    px={2} py={1} borderRadius="full"
                  >
                    {project.project_status || 'Pending'}
                  </Badge>
                </HStack>
                <Text><strong>Capacity:</strong> {project.capacity} kW</Text>
                <Text><strong>Project Cost:</strong> ₹{project.project_cost.toLocaleString()}</Text>
                <Text><strong>Amount Received:</strong> ₹{(project.amount_received || 0).toLocaleString()}</Text>
                <Text><strong>Balance Amount:</strong> ₹{balanceAmount.toLocaleString()}</Text>
                {project.subsidy_scope && (
                  <Text><strong>Subsidy Scope:</strong> {project.subsidy_scope}</Text>
                )}
                {project.material_sent_date && (
                  <Text><strong>Material Sent Date:</strong> {new Date(project.material_sent_date).toLocaleDateString()}</Text>
                )}
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Project Progress */}
        <Card>
          <CardHeader>
            <Text fontSize="lg" fontWeight="semibold" color="gray.700">
              Project Progress
            </Text>
          </CardHeader>
          <CardBody>
            <VStack spacing={4}>
              <HStack justify="space-between" w="full">
                <Text><strong>Current Stage:</strong></Text>
                <Badge
                  colorScheme={getStatusColor(project.project_status || 'pending')}
                  px={3} py={2} borderRadius="full"
                >
                  {project.project_status || 'Pending'}
                </Badge>
              </HStack>

              {/* Stage Progress Bar */}
              <Box w="full">
                <Flex justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.600">Stage Progress</Text>
                  <Text fontSize="sm" color="gray.600">
                    Stage {CHITOOR_PROJECT_STAGES.findIndex(s => s === project.project_status) + 1} of {CHITOOR_PROJECT_STAGES.length}
                  </Text>
                </Flex>
                <Box bg="gray.200" borderRadius="full" h="3">
                  <Box
                    bg="blue.400"
                    h="3"
                    borderRadius="full"
                    width={`${Math.max(((CHITOOR_PROJECT_STAGES.findIndex(s => s === project.project_status) + 1) / CHITOOR_PROJECT_STAGES.length) * 100, 5)}%`}
                  />
                </Box>
              </Box>

              {/* Stage Navigation Buttons */}
              {isAuthenticated && (
                <HStack pt={2} spacing={4}>
                  <Button
                    size="sm"
                    colorScheme="gray"
                    onClick={async () => {
                      if (!project) return;
                      const currentStageIdx = CHITOOR_PROJECT_STAGES.findIndex(s => s.toLowerCase() === (project.project_status || 'pending').toLowerCase());
                      if (currentStageIdx > 0) {
                        try {
                          const newStage = CHITOOR_PROJECT_STAGES[currentStageIdx - 1];
                          const { error } = await supabase
                            .from('chitoor_projects')
                            .update({ project_status: newStage })
                            .eq('id', project.id);

                          if (error) throw error;

                          setProject({ ...project, project_status: newStage });
                          await fetchProjectDetails();

                          toast({
                            title: 'Stage Updated',
                            description: `Moved to: ${newStage}`,
                            status: 'success',
                            duration: 3000,
                            isClosable: true
                          });
                        } catch (error) {
                          console.error('Error updating stage:', error);
                          toast({
                            title: 'Error',
                            description: 'Failed to update stage',
                            status: 'error',
                            duration: 3000,
                            isClosable: true
                          });
                        }
                      }
                    }}
                    isDisabled={!project || !project.project_status || CHITOOR_PROJECT_STAGES.findIndex(s => s.toLowerCase() === (project.project_status || 'pending').toLowerCase()) <= 0}
                    leftIcon={<Text>←</Text>}
                  >
                    Previous Stage
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="green"
                    onClick={async () => {
                      if (!project) return;
                      const currentStageIdx = CHITOOR_PROJECT_STAGES.findIndex(s => s.toLowerCase() === (project.project_status || 'pending').toLowerCase());
                      if (currentStageIdx >= 0 && currentStageIdx < CHITOOR_PROJECT_STAGES.length - 1) {
                        try {
                          const newStage = CHITOOR_PROJECT_STAGES[currentStageIdx + 1];
                          const { error } = await supabase
                            .from('chitoor_projects')
                            .update({ project_status: newStage })
                            .eq('id', project.id);

                          if (error) throw error;

                          setProject({ ...project, project_status: newStage });
                          await fetchProjectDetails();

                          toast({
                            title: 'Stage Updated',
                            description: `Advanced to: ${newStage}`,
                            status: 'success',
                            duration: 3000,
                            isClosable: true
                          });
                        } catch (error) {
                          console.error('Error updating stage:', error);
                          toast({
                            title: 'Error',
                            description: 'Failed to update stage',
                            status: 'error',
                            duration: 3000,
                            isClosable: true
                          });
                        }
                      }
                    }}
                    isDisabled={!project || !project.project_status || CHITOOR_PROJECT_STAGES.findIndex(s => s.toLowerCase() === (project.project_status || 'pending').toLowerCase()) >= CHITOOR_PROJECT_STAGES.length - 1}
                    rightIcon={<Text>→</Text>}
                  >
                    Next Stage
                  </Button>
                </HStack>
              )}

              {/* Payment Progress */}
              <Box w="full">
                <Flex justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.600">Payment Progress</Text>
                  <Text fontSize="sm" color="gray.600">
                    ₹{(project.amount_received || 0).toLocaleString()} / ₹{project.project_cost.toLocaleString()}
                  </Text>
                </Flex>
                <Box bg="gray.200" borderRadius="full" h="2">
                  <Box
                    bg="green.400"
                    h="2"
                    borderRadius="full"
                    width={`${Math.min(((project.amount_received || 0) / project.project_cost) * 100, 100)}%`}
                  />
                </Box>
              </Box>
            </VStack>
          </CardBody>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Text fontSize="lg" fontWeight="semibold" color="gray.700">
                Payment History
              </Text>
              <Button size="sm" colorScheme="blue" onClick={onPaymentOpen}>
                Add Payment
              </Button>
            </Flex>
          </CardHeader>
          <CardBody>
            {paymentHistory.length > 0 ? (
              <TableContainer>
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Amount (₹)</Th>
                      <Th>Mode</Th>
                      <Th>Receipt</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paymentHistory.map((payment) => (
                      <Tr key={payment.id}>
                        <Td>{new Date(payment.payment_date).toLocaleDateString()}</Td>
                        <Td>₹{payment.amount.toLocaleString()}</Td>
                        <Td>{payment.payment_mode || 'Cash'}</Td>
                        <Td>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            variant="outline"
                            onClick={async () => {
                              try {
                                if (!project) return;
                                await generatePaymentReceiptPDF({
                                  date: payment.payment_date,
                                  amount: payment.amount,
                                  receivedFrom: project.customer_name,
                                  paymentMode: payment.payment_mode || 'Cash',
                                  placeOfSupply: 'Andhra Pradesh',
                                  customerAddress: project.address_mandal_village,
                                });
                              } catch (e) {
                                console.error('Receipt generation failed', e);
                                toast({
                                  title: 'Failed to generate receipt',
                                  status: 'error',
                                  duration: 3000,
                                  isClosable: true,
                                });
                              }
                            }}
                          >
                            Download Receipt
                          </Button>
                          {payment.id !== 'initial' && (
                            <Button
                              size="xs"
                              ml={2}
                              colorScheme="red"
                              variant="outline"
                              onClick={() => handleDeletePayment(payment)}
                            >
                              Delete
                            </Button>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            ) : (
              <Text color="gray.500" textAlign="center" py={8}>
                No payments recorded yet
              </Text>
            )}
          </CardBody>
        </Card>
      </VStack>

      {/* Add Payment Modal */}
      <Modal isOpen={isPaymentOpen} onClose={onPaymentClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Payment</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Payment Amount</FormLabel>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount"
                  max={balanceAmount}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Maximum payment amount: ₹{balanceAmount.toLocaleString()}
                </Text>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Payment Date</FormLabel>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Payment Mode</FormLabel>
                <Select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onPaymentClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleAddPayment}
              isLoading={processingPayment}
              loadingText="Adding..."
            >
              Add Payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal isOpen={isCustomerEditOpen} onClose={onCustomerEditClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Customer Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Customer Name</FormLabel>
                <Input
                  value={customerFormData.customer_name}
                  onChange={(e) => setCustomerFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                  placeholder="Enter customer name"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Mobile Number</FormLabel>
                <Input
                  value={customerFormData.mobile_number}
                  onChange={(e) => setCustomerFormData(prev => ({ ...prev, mobile_number: e.target.value }))}
                  placeholder="Enter mobile number"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Address (Mandal, Village)</FormLabel>
                <Input
                  value={customerFormData.address_mandal_village}
                  onChange={(e) => setCustomerFormData(prev => ({ ...prev, address_mandal_village: e.target.value }))}
                  placeholder="Enter address"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Service Number</FormLabel>
                <Input
                  value={customerFormData.service_number}
                  onChange={(e) => setCustomerFormData(prev => ({ ...prev, service_number: e.target.value }))}
                  placeholder="Enter service number (optional)"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onCustomerEditClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={async () => {
                try {
                  if (!project) return;

                  const { error } = await supabase
                    .from('chitoor_projects')
                    .update({
                      customer_name: customerFormData.customer_name,
                      mobile_number: customerFormData.mobile_number,
                      address_mandal_village: customerFormData.address_mandal_village,
                      service_number: customerFormData.service_number || null,
                    })
                    .eq('id', project.id);

                  if (error) throw error;

                  setProject(prev => prev ? {
                    ...prev,
                    customer_name: customerFormData.customer_name,
                    mobile_number: customerFormData.mobile_number,
                    address_mandal_village: customerFormData.address_mandal_village,
                    service_number: customerFormData.service_number,
                  } : null);

                  toast({
                    title: 'Success',
                    description: 'Customer details updated successfully',
                    status: 'success',
                    duration: 3000,
                    isClosable: true,
                  });

                  onCustomerEditClose();
                } catch (error) {
                  console.error('Error updating customer:', error);
                  toast({
                    title: 'Error',
                    description: 'Failed to update customer details',
                    status: 'error',
                    duration: 3000,
                    isClosable: true,
                  });
                }
              }}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Project Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Project Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Capacity (kW)</FormLabel>
                <Input
                  type="number"
                  value={projectFormData.capacity}
                  onChange={(e) => setProjectFormData(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                  placeholder="Enter capacity"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Project Cost (₹)</FormLabel>
                <Input
                  type="number"
                  value={projectFormData.project_cost}
                  onChange={(e) => setProjectFormData(prev => ({ ...prev, project_cost: Number(e.target.value) }))}
                  placeholder="Enter project cost"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Subsidy Scope</FormLabel>
                <Input
                  value={projectFormData.subsidy_scope}
                  onChange={(e) => setProjectFormData(prev => ({ ...prev, subsidy_scope: e.target.value }))}
                  placeholder="Enter subsidy scope"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Material Sent Date</FormLabel>
                <Input
                  type="date"
                  value={projectFormData.material_sent_date}
                  onChange={(e) => setProjectFormData(prev => ({ ...prev, material_sent_date: e.target.value }))}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Project Status</FormLabel>
                <Select
                  value={projectFormData.project_status}
                  onChange={(e) => setProjectFormData(prev => ({ ...prev, project_status: e.target.value }))}
                >
                  {CHITOOR_PROJECT_STAGES.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onEditClose}>Cancel</Button>
            <Button
              colorScheme="blue"
              onClick={async () => {
                try {
                  if (!project) return;
                  const updates: any = {
                    capacity: projectFormData.capacity,
                    project_cost: projectFormData.project_cost,
                    subsidy_scope: projectFormData.subsidy_scope || null,
                    project_status: projectFormData.project_status || null,
                  };
                  if (projectFormData.material_sent_date) {
                    updates.material_sent_date = new Date(projectFormData.material_sent_date).toISOString();
                  } else {
                    updates.material_sent_date = null;
                  }

                  const { error } = await supabase
                    .from('chitoor_projects')
                    .update(updates)
                    .eq('id', project.id);

                  if (error) throw error;

                  setProject(prev => prev ? { ...prev, ...updates } : null);

                  toast({
                    title: 'Project updated',
                    status: 'success',
                    duration: 3000,
                    isClosable: true,
                  });
                  onEditClose();
                } catch (err) {
                  console.error('Project update failed', err);
                  toast({
                    title: 'Failed to update project',
                    status: 'error',
                    duration: 3000,
                    isClosable: true,
                  });
                }
              }}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ChitoorProjectDetails;
