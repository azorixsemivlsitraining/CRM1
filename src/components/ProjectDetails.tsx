import { useParams, useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { generatePaymentReceiptPDF } from './PaymentReceipt';

import {
  Box,
  Text,
  Button,
  VStack,
  HStack,
  Flex,
  Progress,
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
  Tooltip,
  IconButton,
  Select,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

import { PROJECT_STAGES } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import { EditIcon } from '@chakra-ui/icons';

// State mapping function to convert abbreviations to full names
const mapStateToFullName = (state: string): string => {
  const stateMapping: Record<string, string> = {
    'TG': 'Telangana',
    'AP': 'Andhra Pradesh'
  };
  return stateMapping[state] || state;
};

interface Assignment {
  id: number;
  customer_name: string;
  module: { id: number; name: string; watt: number };
  inverter: { id: number; name: string };
  quantity: number;
}


interface PaymentHistory {
  id: string;
  amount: number;
  created_at: string;
  payment_mode?: string;
  payment_date?: string;
}

interface Project {
  id: string;
  name: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  state: 'AP' | 'Telangana';
  dealing_personal: 'Yellesh' | 'Hitesh';
  proposal_amount: number;
  advance_payment: number;
  balance_amount: number;
  paid_amount: number;
  loan_amount: number;
  status: string;
  current_stage: string;
  project_type: 'DCR' | 'Non DCR';
  payment_mode: 'Loan' | 'Cash';
  created_at: string;
  start_date: string;
  payment_history: PaymentHistory[];
  kwh: number;
}


const ProjectDetails = () => {
  // ...existing state
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, isEditor } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => {
    const savedDate = sessionStorage.getItem(`payment_date_${id}`);
    return savedDate || new Date().toISOString().split('T')[0];
  });
  const [paymentMode, setPaymentMode] = useState(() => {
    const savedMode = sessionStorage.getItem(`payment_mode_${id}`);
    return savedMode || 'Cash';
  });
  const [editCustomerLoading, setEditCustomerLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Add separate loading state for different operations
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Customer edit modal state
  const { 
    isOpen: isEditOpen, 
    onOpen: onEditOpen, 
    onClose: onEditClose 
  } = useDisclosure();
  const [customerFormData, setCustomerFormData] = useState({
    customer_name: '',
    email: '',
    phone: '',
    address: '',
    kwh: 0,
    loan_amount: 0,
    start_date: '',
    dealing_personal: 'Project Manager',
  });


  // Project edit modal state
  const {
    isOpen: isProjectEditOpen,
    onOpen: onProjectEditOpen,
    onClose: onProjectEditClose
  } = useDisclosure();
  const [projectEditForm, setProjectEditForm] = useState({
    name: '',
    status: '',
    project_type: '',
    proposal_amount: 0,
    loan_amount: 0,
    start_date: '',
    current_stage: '',
    kwh: 0,
    state: 'Telangana',
  });

  // Prefill project edit form when opening
  const handleProjectEditOpen = () => {
    if (project) {
      setProjectEditForm({
        name: project.name || '',
        status: project.status || '',
        project_type: project.project_type || '',
        proposal_amount: project.proposal_amount || 0,
        loan_amount: project.loan_amount || 0,
        start_date: project.start_date || '',
        current_stage: project.current_stage || '',
        kwh: project.kwh || 0,
        state: project.state || 'Telangana',
      });
    }
    onProjectEditOpen();
  };

  const fetchProjectAndPayments = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch payment history from payment_history table
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_history')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: true }); // oldest first
      if (paymentError) throw paymentError;
      // Always add advance payment as the first row
      let history = paymentData || [];
      if (projectData && projectData.advance_payment && projectData.advance_payment > 0) {
        const advanceRow = {
          id: 'advance',
          amount: projectData.advance_payment,
          created_at: projectData.start_date || projectData.created_at,
          payment_mode: 'Cash',
          payment_date: projectData.start_date || projectData.created_at,
        };
        // Only add if not already present (by amount & date)
        if (!history.some((p: any) => p.amount === advanceRow.amount && p.payment_date === advanceRow.payment_date)) {
          history = [advanceRow, ...history];
        }
      }
      setPaymentHistory(history);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch project or payment data',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const handleProjectEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProjectEditForm(prev => ({
      ...prev,
      [name]: name === 'proposal_amount' || name === 'loan_amount' || name === 'kwh'
        ? (value === '' ? 0 : parseFloat(value) || 0)
        : value
    }));
  };

  const handleProjectEditSave = async () => {
    if (!project) return;
    try {
      setEditLoading(true);
      const { name, status, project_type, proposal_amount, loan_amount, start_date, current_stage, kwh, state } = projectEditForm;
      const { error } = await supabase
        .from('projects')
        .update({
          name,
          status,
          project_type,
          proposal_amount,
          loan_amount,
          start_date,
          current_stage,
          kwh,
          state: mapStateToFullName(state),
        })
        .eq('id', project.id);
      if (error) throw error;
      await fetchProjectAndPayments();
      toast({
        title: 'Project Updated',
        description: 'Project details updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onProjectEditClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update project details',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setEditLoading(false);
    }
  };

  // Add useEffect for timestamp updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Force a re-render to update timestamps
      setProject(prev => ({ ...prev! }));
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchProjectAndPayments();
  }, [fetchProjectAndPayments, isAuthenticated, navigate]);

  // Fetch module assignments for this customer
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!project || !project.customer_name) return;
      const { data, error } = await supabase
        .from('customer_module_assignments')
        .select('id, customer_name, modules(*), inverters(*), quantity')
        .eq('customer_name', project.customer_name);
      if (!error && data) {
        setAssignments(
          data.map((a: any) => ({
            id: a.id,
            customer_name: a.customer_name,
            module: Array.isArray(a.modules) ? a.modules[0] : a.modules,
            inverter: Array.isArray(a.inverters) ? a.inverters[0] : a.inverters,
            quantity: a.quantity,
          }))
        );
      }
    };
    fetchAssignments();
  }, [project]);

  // Initialize customer form data when project is loaded (only once)
  useEffect(() => {
    if (project && !isEditOpen) {
      setCustomerFormData({
        customer_name: project.customer_name || '',
        email: project.email || '',
        phone: project.phone || '',
        address: project.address || '',
        kwh: project.kwh || 0,
        loan_amount: project.loan_amount || 0,
        start_date: project.start_date || '',
        dealing_personal: project.dealing_personal || 'Yellesh',
      });
  }
}, [project, isEditOpen]);

const location = useLocation();
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const edit = params.get('edit');
  if (edit === 'customer') {
    handleEditOpen();
  } else if (edit === 'project') {
    handleProjectEditOpen();
  }
}, [location.search]);

// Reset form data when opening the modal
const handleEditOpen = () => {
  if (project) {
    setCustomerFormData({
      customer_name: project.customer_name || '',
      email: project.email || '',
      phone: project.phone || '',
      address: project.address || '',
      kwh: project.kwh || 0,
      loan_amount: project.loan_amount || 0,
      start_date: project.start_date || '',
      dealing_personal: project.dealing_personal || 'Yellesh',
    });
  }
  onEditOpen();
};

const handleCustomerFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target;
  setCustomerFormData(prev => ({
    ...prev,
    [name]: (name === 'kwh' || name === 'loan_amount') ? (value === '' ? 0 : parseFloat(value) || 0) : value
  }));
};

const handleCustomerEditSave = async () => {
  if (!project) return;
  try {
    setEditCustomerLoading(true);
    const { customer_name, email, phone, address, kwh, loan_amount, start_date, dealing_personal } = customerFormData;
    const { error } = await supabase
      .from('projects')
      .update({
        customer_name,
        email,
        phone,
        address,
        kwh,
        loan_amount,
        start_date,
        dealing_personal,
      })
      .eq('id', project.id);
    if (error) throw error;
    await fetchProjectAndPayments();
    toast({
      title: 'Customer Updated',
      description: 'Customer details updated successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    onEditClose();
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to update customer details',
      status: 'error',
      duration: 3000,
      isClosable: true,
    });
  } finally {
    setEditCustomerLoading(false);
  }
};


const handlePayment = async () => {
  if (!project) return;
  if (!paymentAmount || !paymentDate || !paymentMode) {
    toast({
      title: 'Missing Fields',
      description: 'Please fill all payment details.',
      status: 'warning',
      duration: 3000,
      isClosable: true,
    });
    return;
  }
  try {
    setPaymentLoading(true);
    const { error } = await supabase
      .from('payment_history')
      .insert([{
        project_id: project.id,
        amount: parseFloat(paymentAmount),
        payment_mode: paymentMode,
        payment_date: paymentDate,
      }]);
    if (error) throw error;
    toast({
      title: 'Payment Added',
      description: 'Payment added successfully.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('Cash');
    await fetchProjectAndPayments();
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to add payment.',
      status: 'error',
      duration: 3000,
      isClosable: true,
    });
  } finally {
    setPaymentLoading(false);
  }
};
const handlePaymentDateChange = () => {};
const handlePaymentModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  setPaymentMode(e.target.value);
  if (id) sessionStorage.setItem(`payment_mode_${id}`, e.target.value);
};

// (other imports...)

// ...
// Download payment receipt as PDF
const handleDownloadReceipt = async (payment: PaymentHistory) => {
  if (!project) return;
  const isAdvance = payment.id === 'advance';
  const receiptData = {
    date: payment.payment_date || payment.created_at,
    amount: payment.amount,
    receivedFrom: project.customer_name,
    paymentMode: isAdvance ? 'Cash' : (payment.payment_mode || '-'),
    placeOfSupply: project.state,
    customerAddress: project.address,
  };
  await generatePaymentReceiptPDF(receiptData);
};

// Delete payment handler
const handleDeletePayment = async (payment: PaymentHistory) => {
  if (!project) return;
  const paymentId = payment.id;
  try {
    if (paymentId === 'advance') {
      const updatedBalance = Math.max((project.proposal_amount || 0) - (project.paid_amount || 0), 0);
      const { error } = await supabase
        .from('projects')
        .update({
          advance_payment: 0,
          balance_amount: updatedBalance,
        })
        .eq('id', project.id);
      if (error) throw error;
      setProject(prev => (prev ? { ...prev, advance_payment: 0, balance_amount: updatedBalance } : prev));
      setPaymentHistory(prev => prev.filter(p => p.id !== 'advance'));
      toast({
        title: 'Advance removed',
        description: 'Advance payment entry deleted successfully.',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } else {
      const { error } = await supabase
        .from('payment_history')
        .delete()
        .eq('id', paymentId);
      if (error) throw error;
      setPaymentHistory(prev => prev.filter(p => p.id !== paymentId));
      toast({
        title: 'Payment deleted',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    }
    await fetchProjectAndPayments();
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to delete payment',
      status: 'error',
      duration: 3000,
      isClosable: true,
    });
  }
};

// Render payment history table
const renderPaymentHistory = () => {
  if (!paymentHistory || paymentHistory.length === 0) {
    return (
      <Box mt={8} textAlign="center" color="gray.500">
        No payment history found.
      </Box>
    );
  }
  return (
    <Box mt={8}>
      <Text fontSize="2xl" fontWeight="bold" mb={4}>Payment History</Text>
      <TableContainer>
        <Table variant="simple" size="md">
          <Thead>
            <Tr>
              <Th>Date</Th>
              <Th>Amount (₹)</Th>
              <Th>Mode</Th>
              <Th>Receipt</Th>
            </Tr>
          </Thead>
          <Tbody>
            {paymentHistory.map((p, idx) => (
              <Tr key={p.id}>
                <Td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : (p.created_at ? new Date(p.created_at).toLocaleDateString() : '')}</Td>
                <Td>{p.amount != null ? p.amount.toLocaleString() : ''}</Td>
                <Td>{p.payment_mode || '-'}</Td>
                <Td>
                  <Button size="sm" colorScheme="blue" onClick={() => handleDownloadReceipt(p)}>
                    Download Receipt
                  </Button>
                  {isEditor && (
                    <Button
                      size="sm"
                      colorScheme="red"
                      ml={2}
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this payment record?')) {
                          handleDeletePayment(p);
                        }
                      }}
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
    </Box>
  );
};

return (
  <Box p={6} maxW="5xl" mx="auto">
    {/* Header with Edit Options */}
    {isEditor && (
      <Card mb={6} bg="blue.50" borderColor="blue.200" borderWidth={1}>
        <CardHeader>
          <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
            <Box>
              <Text fontSize="xl" fontWeight="bold" color="blue.700">
                Project Management
              </Text>
              <Text fontSize="sm" color="blue.600">
                Edit project and customer details
              </Text>
            </Box>
            <HStack spacing={3}>
              <Button
                leftIcon={<EditIcon />}
                colorScheme="blue"
                variant="outline"
                onClick={handleEditOpen}
                size="sm"
              >
                Edit Customer
              </Button>
              <Button
                leftIcon={<EditIcon />}
                colorScheme="green"
                onClick={handleProjectEditOpen}
                size="sm"
              >
                Edit Project
              </Button>
            </HStack>
          </Flex>
        </CardHeader>
      </Card>
    )}

    {/* Details Cards Grid */}
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={8}>
      {/* Customer Details Card */}
      <Card boxShadow="lg" borderRadius="lg" bg="white" position="relative">
        <CardHeader display="flex" alignItems="center" justifyContent="space-between">
          <Text fontSize="2xl" fontWeight="bold">Customer Details</Text>
          {isEditor && (
            <Tooltip label="Edit customer" hasArrow>
              <IconButton
                aria-label="Edit customer"
                icon={<EditIcon />}
                colorScheme="blue"
                variant="ghost"
                size="sm"
                onClick={handleEditOpen}
              />
            </Tooltip>
          )}
        </CardHeader>
        <CardBody>
          <VStack align="start" spacing={2}>
            <Text><b>Name:</b> {project?.customer_name}</Text>
            <Text><b>Email:</b> {project?.email}</Text>
            <Text><b>Phone:</b> {project?.phone}</Text>
            <Text><b>Address:</b> {project?.address}</Text>
            <Text><b>KWH:</b> {project?.kwh}</Text>
            <Text><b>Loan Amount:</b> ₹{project?.loan_amount?.toLocaleString()}</Text>
            <Text><b>Start Date:</b> {project?.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}</Text>
            <Text><b>Dealing Personal:</b> {project?.dealing_personal}</Text>
            {/* Assigned Modules Section */}
            {assignments.length > 0 && (
              <Box mt={2} w="100%">
                <Text fontWeight="bold" mt={2} mb={1}>Assigned Modules & Inverters:</Text>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Module</Th>
                      <Th>Watt</Th>
                      <Th>Qty</Th>
                      <Th>Inverter</Th>
                      <Th>KWH</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {assignments.map(a => (
                      <Tr key={a.id}>
                        <Td>{a.module?.name}</Td>
                        <Td>{a.module?.watt}</Td>
                        <Td>{a.quantity}</Td>
                        <Td>{a.inverter?.name}</Td>
                        <Td>{a.module?.watt && a.quantity ? ((a.module.watt * a.quantity) / 1000).toFixed(2) : ''}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </VStack>
        </CardBody>
      </Card>
      <Card boxShadow="lg" borderRadius="lg" bg="white" position="relative">
        <CardHeader display="flex" alignItems="center" justifyContent="space-between">
          <Text fontSize="2xl" fontWeight="bold">Project Details</Text>
          {isEditor && (
            <Tooltip label="Edit project" hasArrow>
              <IconButton
                aria-label="Edit project"
                icon={<EditIcon />}
                colorScheme="green"
                variant="ghost"
                size="sm"
                onClick={handleProjectEditOpen}
              />
            </Tooltip>
          )}
        </CardHeader>
        <CardBody>
          <VStack align="start" spacing={3}>
            <Text><b>Project Name:</b> {project ? project.name : ''}</Text>
            <Text><b>Status:</b> {project ? project.status : ''}</Text>
            <Text><b>Type:</b> {project ? project.project_type : ''}</Text>
            <Text><b>State:</b> {project ? project.state : ''}</Text>
            <Text><b>Proposal Amount:</b> ����{project && project.proposal_amount != null ? project.proposal_amount.toLocaleString() : ''}</Text>
            <Text><b>Advance Payment:</b> ₹{project && project.advance_payment != null ? project.advance_payment.toLocaleString() : ''}</Text>
            <Text><b>Paid Amount:</b> ₹{project && project.paid_amount != null ? project.paid_amount.toLocaleString() : ''}</Text>
            <Text><b>Balance Amount:</b> ₹{project && project.balance_amount != null ? project.balance_amount.toLocaleString() : ''}</Text>
            <Text><b>Loan Amount:</b> ₹{project && project.loan_amount != null ? project.loan_amount.toLocaleString() : ''}</Text>
            <Text><b>Current Stage:</b> {project ? project.current_stage : ''}</Text>
            <Text><b>KWH:</b> {project ? project.kwh : ''}</Text>
            <Text><b>Start Date:</b> {project && project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'}</Text>
            <Text><b>Created At:</b> {project && project.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A'}</Text>
          </VStack>
        </CardBody>
      </Card>
    </SimpleGrid>

    {/* Project Progress Card */}
    <Card mt={4} boxShadow="lg" borderRadius="lg" bg="white">
      <CardHeader>
        <Text fontSize="2xl" fontWeight="bold">Project Progress</Text>
      </CardHeader>
      <CardBody>
        <VStack align="start" spacing={4}>
          <HStack>
            <Text><b>Status:</b></Text>
            {project && project.status && (
              <Badge colorScheme={project.status === 'active' ? 'green' : 'gray'} textTransform="uppercase">
                {project.status}
              </Badge>
            )}
          </HStack>
          <Text><b>Current Stage:</b> {project ? project.current_stage : ''}</Text>
          {/* Progress Bar */}
          {project && (
            <Progress
              value={
                PROJECT_STAGES.findIndex(s => s === project.current_stage) >= 0
                  ? ((PROJECT_STAGES.findIndex(s => s === project.current_stage) + 1) / PROJECT_STAGES.length) * 100
                  : 0
              }
              size="md"
              colorScheme="blue"
              borderRadius="md"
              w="100%"
            />
          )}
          {/* Stage Navigation Buttons - Functional for all authenticated users */}
          {isAuthenticated && (
            <HStack pt={2} spacing={4}>
              <Button
                size="sm"
                colorScheme="gray"
                onClick={async () => {
                  if (!project) return;
                  const currentStageIdx = PROJECT_STAGES.findIndex(s => s.toLowerCase() === project.current_stage.toLowerCase());
                  if (currentStageIdx > 0) {
                    try {
                      const newStage = PROJECT_STAGES[currentStageIdx - 1];
                      const { error } = await supabase
                        .from('projects')
                        .update({ current_stage: newStage })
                        .eq('id', project.id);

                      if (error) throw error;

                      // Update local state and refresh data
                      setProject({ ...project, current_stage: newStage });
                      await fetchProjectAndPayments(); // Refresh all data

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
                isDisabled={!project || !project.current_stage || PROJECT_STAGES.findIndex(s => s.toLowerCase() === project.current_stage.toLowerCase()) <= 0}
                leftIcon={<Text>←</Text>}
              >
                Previous Stage
              </Button>
              <Button
                size="sm"
                colorScheme="green"
                onClick={async () => {
                  if (!project) return;
                  const currentStageIdx = PROJECT_STAGES.findIndex(s => s.toLowerCase() === project.current_stage.toLowerCase());
                  if (currentStageIdx >= 0 && currentStageIdx < PROJECT_STAGES.length - 1) {
                    try {
                      const newStage = PROJECT_STAGES[currentStageIdx + 1];
                      const { error } = await supabase
                        .from('projects')
                        .update({ current_stage: newStage })
                        .eq('id', project.id);

                      if (error) throw error;

                      // Update local state and refresh data
                      setProject({ ...project, current_stage: newStage });
                      await fetchProjectAndPayments(); // Refresh all data

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
                isDisabled={!project || !project.current_stage || PROJECT_STAGES.findIndex(s => s.toLowerCase() === project.current_stage.toLowerCase()) >= PROJECT_STAGES.length - 1}
                rightIcon={<Text>→</Text>}
              >
                Next Stage
              </Button>
            </HStack>
          )}
        </VStack>
      </CardBody>
    </Card>

    {/* Customer Edit Modal */}
    <Modal isOpen={isEditOpen} onClose={onEditClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Customer Details</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Name</FormLabel>
              <Input name="customer_name" value={customerFormData.customer_name} onChange={handleCustomerFormChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input name="email" value={customerFormData.email} onChange={handleCustomerFormChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Phone</FormLabel>
              <Input name="phone" value={customerFormData.phone} onChange={handleCustomerFormChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Address</FormLabel>
              <Input name="address" value={customerFormData.address} onChange={handleCustomerFormChange} />
            </FormControl>
            <FormControl>
              <FormLabel>KWH</FormLabel>
              <Input type="number" name="kwh" value={customerFormData.kwh} onChange={handleCustomerFormChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Loan Amount</FormLabel>
              <Input type="number" name="loan_amount" value={customerFormData.loan_amount} onChange={handleCustomerFormChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Start Date</FormLabel>
              <Input type="date" name="start_date" value={customerFormData.start_date} onChange={handleCustomerFormChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Dealing Personal</FormLabel>
              <Select name="dealing_personal" value={customerFormData.dealing_personal} onChange={handleCustomerFormChange}>
                <option value="Yellesh">Yellesh</option>
                <option value="Hitesh">Hitesh</option>
              </Select>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onEditClose} mr={3} isDisabled={editCustomerLoading}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleCustomerEditSave} isLoading={editCustomerLoading}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>

    {/* Project Edit Modal */}
    <Modal isOpen={isProjectEditOpen} onClose={onProjectEditClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Project Details</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Project Name</FormLabel>
              <Input name="name" value={projectEditForm.name} onChange={handleProjectEditChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Status</FormLabel>
              <Input name="status" value={projectEditForm.status} onChange={handleProjectEditChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Type</FormLabel>
              <Select name="project_type" value={projectEditForm.project_type} onChange={handleProjectEditChange}>
                <option value="DCR">DCR</option>
                <option value="Non DCR">Non DCR</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>State</FormLabel>
              <Select name="state" value={projectEditForm.state} onChange={handleProjectEditChange}>
                <option value="TG">TG (Telangana)</option>
                <option value="AP">AP (Andhra Pradesh)</option>
                <option disabled>─────────────</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Telangana">Telangana</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Kerala">Kerala</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Punjab">Punjab</option>
                <option value="Haryana">Haryana</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Bihar">Bihar</option>
                <option value="West Bengal">West Bengal</option>
                <option value="Odisha">Odisha</option>
                <option value="Madhya Pradesh">Madhya Pradesh</option>
                <option value="Chhattisgarh">Chhattisgarh</option>
                <option value="Jharkhand">Jharkhand</option>
                <option value="Assam">Assam</option>
                <option value="Himachal Pradesh">Himachal Pradesh</option>
                <option value="Uttarakhand">Uttarakhand</option>
                <option value="Goa">Goa</option>
                <option value="Delhi">Delhi</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Proposal Amount</FormLabel>
              <Input type="number" name="proposal_amount" value={projectEditForm.proposal_amount} onChange={handleProjectEditChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Loan Amount</FormLabel>
              <Input type="number" name="loan_amount" value={projectEditForm.loan_amount} onChange={handleProjectEditChange} />
            </FormControl>
            <FormControl>
              <FormLabel>Start Date</FormLabel>
              <Input type="date" name="start_date" value={projectEditForm.start_date} onChange={handleProjectEditChange} />
            </FormControl>
            {/* Use PROJECT_STAGES for stage selection */}
            <FormControl>
              <FormLabel>Current Stage</FormLabel>
              <Select name="current_stage" value={projectEditForm.current_stage} onChange={handleProjectEditChange}>
                <option value="">Select Stage</option>
                {PROJECT_STAGES.map((stage: string) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>KWH</FormLabel>
              <Input type="number" name="kwh" value={projectEditForm.kwh} onChange={handleProjectEditChange} />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onProjectEditClose} mr={3} isDisabled={editLoading}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleProjectEditSave} isLoading={editLoading}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>

    {/* Add Payment Card/Modal */}
    <Card mt={8}>
      <CardHeader>
        <Text fontSize="2xl" fontWeight="bold">Add Payment</Text>
      </CardHeader>
      <CardBody>
        <VStack align="start" spacing={4}>
          <FormControl isRequired>
            <FormLabel>Payment Amount</FormLabel>
            <Input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Enter payment amount"
              max={project ? project.proposal_amount - (project.advance_payment + (project.paid_amount || 0)) : undefined}
              min={0}
              step="0.01"
              isDisabled={paymentLoading}
            />
            <Text fontSize="sm" color="gray.500">
              Maximum payment amount: ₹{project ? (project.proposal_amount - (project.advance_payment + (project.paid_amount || 0))).toLocaleString() : ''}
            </Text>
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Payment Date</FormLabel>
            <Input
              type="date"
              value={paymentDate}
              onChange={handlePaymentDateChange}
              isDisabled={paymentLoading}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Payment Mode</FormLabel>
            <Select
              value={paymentMode}
              onChange={handlePaymentModeChange}
              isDisabled={paymentLoading}
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
              <option value="Subsidy">Subsidy</option>
            </Select>
          </FormControl>
          <Button
            colorScheme="green"
            width="full"
            onClick={handlePayment}
            isLoading={paymentLoading}
            loadingText="Adding"
            isDisabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || (project && parseFloat(paymentAmount) > (project.proposal_amount - (project.advance_payment + (project.paid_amount || 0)))) || paymentLoading}
          >
            Add Payment
          </Button>
        </VStack>
      </CardBody>
    </Card>

    {/* Payment History Section */}
    {renderPaymentHistory()}

  </Box>
);
}
export default ProjectDetails;
