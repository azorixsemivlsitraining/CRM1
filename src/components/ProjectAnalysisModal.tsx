import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Grid,
  GridItem,
  Box,
  Text,
  Divider,
  useToast,
  Heading,
  SimpleGrid,
  Badge,
  Flex,
} from '@chakra-ui/react';
import { ProjectAnalysisData, calculateTotalExpenses, calculateProfitRightNow, calculateOverallProfit } from '../utils/projectAnalysisClient';

interface ProjectAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectAnalysisData | null;
  onSave: (data: ProjectAnalysisData) => Promise<void>;
  isSaving?: boolean;
}

export const ProjectAnalysisModal: React.FC<ProjectAnalysisModalProps> = ({
  isOpen,
  onClose,
  project,
  onSave,
  isSaving = false,
}) => {
  const [formData, setFormData] = useState<ProjectAnalysisData | null>(project);
  const toast = useToast();

  React.useEffect(() => {
    setFormData(project);
  }, [project]);

  if (!formData) return null;

  const handleInputChange = (field: keyof ProjectAnalysisData, value: any) => {
    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleSave = async () => {
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  // Calculate totals for display
  const totalExp = calculateTotalExpenses(formData);
  const profitRightNow = calculateProfitRightNow(formData);
  const overallProfit = calculateOverallProfit(formData);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent>
        <ModalHeader>
          <VStack align="start" spacing={1}>
            <Heading size="md">Project Analysis - {formData.customer_name}</Heading>
            <Text fontSize="sm" color="gray.600">
              {formData.mobile_no}
            </Text>
          </VStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Project Info Section */}
            <Box>
              <Heading size="sm" mb={3}>
                Project Information
              </Heading>
              <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Customer Name</FormLabel>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    isReadOnly
                    bg="gray.50"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Mobile No</FormLabel>
                  <Input
                    value={formData.mobile_no}
                    onChange={(e) => handleInputChange('mobile_no', e.target.value)}
                    isReadOnly
                    bg="gray.50"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Project Capacity (kW)</FormLabel>
                  <Input
                    value={formData.project_capacity}
                    isReadOnly
                    bg="gray.50"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">State</FormLabel>
                  <Input
                    value={formData.state || 'Other'}
                    isReadOnly
                    bg="gray.50"
                  />
                </FormControl>
              </Grid>
            </Box>

            <Divider />

            {/* Cost Breakdown Section */}
            <Box>
              <Heading size="sm" mb={3}>
                Cost Breakdown
              </Heading>
              <SimpleGrid columns={2} spacing={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Total Quoted Cost</FormLabel>
                  <Input
                    type="number"
                    value={formData.total_quoted_cost}
                    onChange={(e) => handleInputChange('total_quoted_cost', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Application Charges</FormLabel>
                  <Input
                    type="number"
                    value={formData.application_charges || 0}
                    onChange={(e) => handleInputChange('application_charges', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Modules Cost</FormLabel>
                  <Input
                    type="number"
                    value={formData.modules_cost || 0}
                    onChange={(e) => handleInputChange('modules_cost', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Inverter Cost</FormLabel>
                  <Input
                    type="number"
                    value={formData.inverter_cost || 0}
                    onChange={(e) => handleInputChange('inverter_cost', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Structure Cost</FormLabel>
                  <Input
                    type="number"
                    value={formData.structure_cost || 0}
                    onChange={(e) => handleInputChange('structure_cost', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Hardware Cost</FormLabel>
                  <Input
                    type="number"
                    value={formData.hardware_cost || 0}
                    onChange={(e) => handleInputChange('hardware_cost', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Electrical Equipment</FormLabel>
                  <Input
                    type="number"
                    value={formData.electrical_equipment || 0}
                    onChange={(e) => handleInputChange('electrical_equipment', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Transport Segment</FormLabel>
                  <Input
                    type="number"
                    value={formData.transport_segment || 0}
                    onChange={(e) => handleInputChange('transport_segment', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Installation Cost</FormLabel>
                  <Input
                    type="number"
                    value={formData.installation_cost || 0}
                    onChange={(e) => handleInputChange('installation_cost', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Subsidy Application</FormLabel>
                  <Input
                    type="number"
                    value={formData.subsidy_application || 0}
                    onChange={(e) => handleInputChange('subsidy_application', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Dept Charges</FormLabel>
                  <Input
                    type="number"
                    value={formData.dept_charges || 0}
                    onChange={(e) => handleInputChange('dept_charges', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Civil Work Cost</FormLabel>
                  <Input
                    type="number"
                    value={formData.civil_work_cost || 0}
                    onChange={(e) => handleInputChange('civil_work_cost', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Payment Section */}
            <Box>
              <Heading size="sm" mb={3}>
                Payment Details
              </Heading>
              <SimpleGrid columns={2} spacing={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Payment Received</FormLabel>
                  <Input
                    type="number"
                    value={formData.payment_received || 0}
                    onChange={(e) => handleInputChange('payment_received', Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Pending Payment</FormLabel>
                  <Input
                    type="number"
                    value={formData.pending_payment || 0}
                    isReadOnly
                    bg="gray.50"
                    placeholder="0"
                  />
                </FormControl>
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Summary Section - Read Only */}
            <Box>
              <Heading size="sm" mb={3}>
                Financial Summary
              </Heading>
              <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                <Box p={3} bg="orange.50" borderRadius="lg" border="1px solid" borderColor="orange.100">
                  <Text fontSize="xs" color="gray.600" fontWeight="medium" mb={1}>
                    Total Expenses
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color="orange.600">
                    ₹{Math.round(totalExp).toLocaleString()}
                  </Text>
                </Box>
                <Box p={3} bg="green.50" borderRadius="lg" border="1px solid" borderColor="green.100">
                  <Text fontSize="xs" color="gray.600" fontWeight="medium" mb={1}>
                    Profit Right Now
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color={profitRightNow >= 0 ? 'green.600' : 'red.600'}>
                    ₹{Math.round(profitRightNow).toLocaleString()}
                  </Text>
                </Box>
                <Box p={3} bg="blue.50" borderRadius="lg" border="1px solid" borderColor="blue.100">
                  <Text fontSize="xs" color="gray.600" fontWeight="medium" mb={1}>
                    Overall Profit
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color={overallProfit >= 0 ? 'blue.600' : 'red.600'}>
                    ₹{Math.round(overallProfit).toLocaleString()}
                  </Text>
                </Box>
              </Grid>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSave} isLoading={isSaving} loadingText="Saving...">
              Save Changes
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ProjectAnalysisModal;
