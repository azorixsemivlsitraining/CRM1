import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Text,
  useToast,
  Select,
  Divider,
  Heading,
  SimpleGrid,
  NumberInput,
  NumberInputField,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Card,
  CardBody,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Badge,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { supabase } from '../lib/supabase';

interface Project {
  id: string;
  customer_name: string;
  phone: string;
  kwh: number;
  proposal_amount: number;
}

interface PaymentDate {
  date: string;
  amount: number;
  type: 'Advance' | 'Partial' | 'Final';
}

interface ProjectAnalysisData {
  id?: string;
  project_id: string;
  customer_name: string;
  mobile_no: string;
  project_capacity: number;
  total_quoted_cost: number;
  project_start_date?: string;
  completion_date?: string;
  payment_dates?: PaymentDate[];
  application_charges?: number;
  modules_cost?: number;
  inverter_cost?: number;
  structure_cost?: number;
  hardware_cost?: number;
  electrical_equipment?: number;
  transport_segment?: number;
  installation_cost?: number;
  subsidy_application?: number;
  misc_dept_charges?: number;
  dept_charges?: number;
  civil_work_cost?: number;
  total_exp?: number;
  payment_received?: number;
  pending_payment?: number;
  profit_right_now?: number;
  overall_profit?: number;
}

interface ProjectAnalysisFormProps {
  projectId?: string;
  onSave?: () => void;
}

const ProjectAnalysisForm: React.FC<ProjectAnalysisFormProps> = ({ projectId, onSave }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProjectAnalysisData>({
    project_id: projectId || '',
    customer_name: '',
    mobile_no: '',
    project_capacity: 0,
    total_quoted_cost: 0,
    payment_dates: [],
    application_charges: 0,
    modules_cost: 0,
    inverter_cost: 0,
    structure_cost: 0,
    hardware_cost: 0,
    electrical_equipment: 0,
    transport_segment: 0,
    installation_cost: 0,
    subsidy_application: 0,
    misc_dept_charges: 0,
    dept_charges: 0,
    civil_work_cost: 0,
  });

  const [newPayment, setNewPayment] = useState<PaymentDate>({ date: '', amount: 0, type: 'Advance' });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, customer_name, phone, kwh, proposal_amount')
        .order('customer_name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({ title: 'Error fetching projects', description: error.message, status: 'error', duration: 3000 });
    }
  };

  const handleProjectSelect = (projectId: string) => {
    const selected = projects.find(p => p.id === projectId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        project_id: projectId,
        customer_name: selected.customer_name,
        mobile_no: selected.phone || '',
        project_capacity: selected.kwh || 0,
        total_quoted_cost: selected.proposal_amount || 0,
      }));
    }
  };

  const handleInputChange = (field: keyof ProjectAnalysisData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddPayment = () => {
    if (!newPayment.date || !newPayment.amount) {
      toast({ title: 'Please fill all payment fields', status: 'warning', duration: 2000 });
      return;
    }

    setFormData(prev => ({
      ...prev,
      payment_dates: [...(prev.payment_dates || []), newPayment],
    }));

    setNewPayment({ date: '', amount: 0, type: 'Advance' });
    onClose();
    toast({ title: 'Payment added', status: 'success', duration: 2000 });
  };

  const handleRemovePayment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      payment_dates: (prev.payment_dates || []).filter((_, i) => i !== index),
    }));
  };

  const calculateTotalExpenses = (): number => {
    return (
      (formData.application_charges || 0) +
      (formData.modules_cost || 0) +
      (formData.inverter_cost || 0) +
      (formData.structure_cost || 0) +
      (formData.hardware_cost || 0) +
      (formData.electrical_equipment || 0) +
      (formData.transport_segment || 0) +
      (formData.installation_cost || 0) +
      (formData.subsidy_application || 0) +
      (formData.misc_dept_charges || 0) +
      (formData.dept_charges || 0) +
      (formData.civil_work_cost || 0)
    );
  };

  const calculateTotalPaymentReceived = (): number => {
    return (formData.payment_dates || []).reduce((sum, p) => sum + p.amount, 0);
  };

  const totalExp = calculateTotalExpenses();
  const totalPaymentReceived = calculateTotalPaymentReceived();
  const pendingPayment = (formData.total_quoted_cost || 0) - totalPaymentReceived;
  const profitRightNow = totalPaymentReceived - totalExp;
  const overallProfit = (formData.total_quoted_cost || 0) - totalExp;

  const handleSave = async () => {
    if (!formData.project_id) {
      toast({ title: 'Please select a project', status: 'warning', duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        total_exp: totalExp,
        payment_received: totalPaymentReceived,
        pending_payment: pendingPayment,
        profit_right_now: profitRightNow,
        overall_profit: overallProfit,
      };

      const { data, error } = await supabase
        .from('project_analysis_details')
        .upsert(dataToSave, { onConflict: 'project_id' })
        .select();

      if (error) throw error;

      toast({ title: 'Project analysis saved successfully', status: 'success', duration: 3000 });
      if (onSave) onSave();
    } catch (error: any) {
      toast({ title: 'Error saving project analysis', description: error.message, status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="1200px" mx="auto" p={6}>
      <Card>
        <CardBody>
          <VStack spacing={6} align="stretch">
            {/* Header Section */}
            <Box>
              <Heading size="lg" mb={4}>Project Analysis Form</Heading>
              <Divider />
            </Box>

            {/* Basic Info */}
            <Box>
              <Heading size="md" mb={4}>Basic Information</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Select Project</FormLabel>
                  <Select 
                    value={formData.project_id}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    placeholder="Choose a project"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.customer_name} - {p.kwh}kW - ₹{p.proposal_amount}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Customer Name</FormLabel>
                  <Input value={formData.customer_name} isReadOnly bg="gray.100" />
                </FormControl>

                <FormControl>
                  <FormLabel>Mobile No</FormLabel>
                  <Input value={formData.mobile_no} isReadOnly bg="gray.100" />
                </FormControl>

                <FormControl>
                  <FormLabel>Project Capacity (kW)</FormLabel>
                  <Input value={formData.project_capacity} isReadOnly bg="gray.100" />
                </FormControl>

                <FormControl>
                  <FormLabel>Total Quoted Cost (₹)</FormLabel>
                  <Input value={formData.total_quoted_cost} isReadOnly bg="gray.100" />
                </FormControl>

                <FormControl>
                  <FormLabel>Project Start Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.project_start_date || ''}
                    onChange={(e) => handleInputChange('project_start_date' as keyof ProjectAnalysisData, e.target.value)}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Completion Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.completion_date || ''}
                    onChange={(e) => handleInputChange('completion_date' as keyof ProjectAnalysisData, e.target.value)}
                  />
                </FormControl>
              </SimpleGrid>
            </Box>

            {/* Payment Dates */}
            <Box>
              <Heading size="md" mb={4}>Payment Received Dates</Heading>
              <Button leftIcon={<AddIcon />} colorScheme="green" size="sm" mb={4} onClick={onOpen}>
                Add Payment
              </Button>

              {(formData.payment_dates || []).length > 0 && (
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Amount (₹)</Th>
                      <Th>Type</Th>
                      <Th>Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {formData.payment_dates?.map((payment, index) => (
                      <Tr key={index}>
                        <Td>{payment.date}</Td>
                        <Td>₹{payment.amount}</Td>
                        <Td>
                          <Badge colorScheme={payment.type === 'Advance' ? 'blue' : payment.type === 'Partial' ? 'purple' : 'green'}>
                            {payment.type}
                          </Badge>
                        </Td>
                        <Td>
                          <IconButton 
                            aria-label="Delete payment"
                            icon={<DeleteIcon />} 
                            size="sm" 
                            colorScheme="red"
                            onClick={() => handleRemovePayment(index)}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </Box>

            <Divider />

            {/* Cost Details */}
            <Box>
              <Heading size="md" mb={4}>Cost Details (Manual Entry)</Heading>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                {[
                  { label: 'Application Charges (₹)', field: 'application_charges' as keyof ProjectAnalysisData },
                  { label: 'Modules Cost (₹)', field: 'modules_cost' as keyof ProjectAnalysisData },
                  { label: 'Inverter Cost (₹)', field: 'inverter_cost' as keyof ProjectAnalysisData },
                  { label: 'Structure Cost (₹)', field: 'structure_cost' as keyof ProjectAnalysisData },
                  { label: 'Hardware Cost (₹)', field: 'hardware_cost' as keyof ProjectAnalysisData },
                  { label: 'Electrical Equipment (₹)', field: 'electrical_equipment' as keyof ProjectAnalysisData },
                  { label: 'Transport Segment (₹)', field: 'transport_segment' as keyof ProjectAnalysisData },
                  { label: 'Installation Cost (₹)', field: 'installation_cost' as keyof ProjectAnalysisData },
                  { label: 'Subsidy Application (₹)', field: 'subsidy_application' as keyof ProjectAnalysisData },
                  { label: 'Misc Dept Charges (₹)', field: 'misc_dept_charges' as keyof ProjectAnalysisData },
                  { label: 'Dept Charges (₹)', field: 'dept_charges' as keyof ProjectAnalysisData },
                  { label: 'Civil Work Cost (₹)', field: 'civil_work_cost' as keyof ProjectAnalysisData },
                ].map(({ label, field }) => (
                  <FormControl key={field}>
                    <FormLabel fontSize="sm">{label}</FormLabel>
                    <Input
                      type="number"
                      value={formData[field] as number || 0}
                      onChange={(e) => handleInputChange(field, parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </FormControl>
                ))}
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Summary Section */}
            <Box bg="blue.50" p={4} borderRadius="md">
              <Heading size="md" mb={4}>Summary</Heading>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                <Box>
                  <Text fontSize="sm" color="gray.600">Total Expenses</Text>
                  <Text fontSize="lg" fontWeight="bold">₹{totalExp.toLocaleString()}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">Payment Received</Text>
                  <Text fontSize="lg" fontWeight="bold" color="green.600">₹{totalPaymentReceived.toLocaleString()}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">Pending Payment</Text>
                  <Text fontSize="lg" fontWeight="bold" color="orange.600">₹{pendingPayment.toLocaleString()}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">Profit Right Now</Text>
                  <Text fontSize="lg" fontWeight="bold" color={profitRightNow >= 0 ? 'green.600' : 'red.600'}>
                    ₹{profitRightNow.toLocaleString()}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">Overall Profit</Text>
                  <Text fontSize="lg" fontWeight="bold" color={overallProfit >= 0 ? 'green.600' : 'red.600'}>
                    ₹{overallProfit.toLocaleString()}
                  </Text>
                </Box>
              </SimpleGrid>
            </Box>

            {/* Buttons */}
            <HStack spacing={4} justify="flex-end">
              <Button variant="outline" colorScheme="gray">Cancel</Button>
              <Button 
                colorScheme="green" 
                isLoading={loading}
                onClick={handleSave}
              >
                Save Changes
              </Button>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Payment Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Payment</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Date</FormLabel>
                <Input 
                  type="date"
                  value={newPayment.date}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, date: e.target.value }))}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Amount (₹)</FormLabel>
                <Input
                  type="number"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                  min={0}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select 
                  value={newPayment.type}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <option value="Advance">Advance</option>
                  <option value="Partial">Partial</option>
                  <option value="Final">Final</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="green" onClick={handleAddPayment}>Add</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ProjectAnalysisForm;
