import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Radio,
  RadioGroup,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useColorModeValue,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface CsaFormState {
  customerName: string;
  contactNumber: string;
  projectLocation: string;
  projectManager: string;
  installationCompletionDate: string;
  installationQuality: string;
  timelinessOfCompletion: string;
  staffProfessionalism: string;
  communicationUpdates: string;
  overallSatisfaction: string;
  serviceLikes: string;
  improvementAreas: string;
  projectIssues: string;
  wouldRecommend: string;
  permissionToUseTestimonial: string;
}

const initialFormState: CsaFormState = {
  customerName: '',
  contactNumber: '',
  projectLocation: '',
  projectManager: '',
  installationCompletionDate: '',
  installationQuality: '',
  timelinessOfCompletion: '',
  staffProfessionalism: '',
  communicationUpdates: '',
  overallSatisfaction: '',
  serviceLikes: '',
  improvementAreas: '',
  projectIssues: '',
  wouldRecommend: '',
  permissionToUseTestimonial: '',
};

const ratingOptions = ['1', '2', '3', '4', '5'];

const CSA: React.FC = () => {
  const [form, setForm] = useState<CsaFormState>(initialFormState);
  const toast = useToast();
  const location = useLocation();
  const { user } = useAuth();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const titleColor = useColorModeValue('gray.700', 'gray.200');
  const canAccessCsa = ['gopi@axisogreen.in', 'admin@axisogreen.in'].includes(user?.email?.toLowerCase() || '');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextValues = {
      customerName: params.get('customerName') || '',
      contactNumber: params.get('contactNumber') || '',
      projectLocation: params.get('projectLocation') || '',
      projectManager: params.get('projectManager') || '',
    };

    if (Object.values(nextValues).some(Boolean)) {
      setForm((current) => ({ ...current, ...nextValues }));
    }
  }, [location.search]);

  const ratingFields = useMemo(
    () => [
      { key: 'installationQuality', label: 'Installation Quality' },
      { key: 'timelinessOfCompletion', label: 'Timeliness of Completion' },
      { key: 'staffProfessionalism', label: 'Staff Professionalism' },
      { key: 'communicationUpdates', label: 'Communication & Updates' },
      { key: 'overallSatisfaction', label: 'Overall Satisfaction' },
    ],
    []
  );

  const handleChange = (field: keyof CsaFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    toast({
      title: 'CSA form ready',
      description: 'The feedback form has been captured in the page.',
      status: 'success',
      duration: 3500,
      isClosable: true,
    });
  };

  if (!canAccessCsa) {
    return (
      <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" boxShadow="sm">
        <CardBody py={10} textAlign="center">
          <Heading size="lg" color="red.500" mb={3}>
            Access denied
          </Heading>
          <Text color={titleColor}>
            CSA is available only for authorized users.
          </Text>
        </CardBody>
      </Card>
    );
  }

  return (
    <Box>
      <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" boxShadow="sm">
        <CardHeader pb={0}>
          <Heading size="lg" color="brand.600">
            CSA
          </Heading>
          <Text mt={1} color={titleColor}>
            Customer Satisfaction Assessment
          </Text>
        </CardHeader>
        <CardBody>
          <Box as="form" onSubmit={handleSubmit}>
            <VStack spacing={8} align="stretch">
              <Box>
                <Heading size="md" mb={4} color="brand.600">
                  Project Details
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Customer Name</FormLabel>
                    <Input value={form.customerName} onChange={(e) => handleChange('customerName', e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Contact Number</FormLabel>
                    <Input value={form.contactNumber} onChange={(e) => handleChange('contactNumber', e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Project Location</FormLabel>
                    <Input value={form.projectLocation} onChange={(e) => handleChange('projectLocation', e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Project Manager</FormLabel>
                    <Input value={form.projectManager} onChange={(e) => handleChange('projectManager', e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Installation Completion Date</FormLabel>
                    <Input type="date" value={form.installationCompletionDate} onChange={(e) => handleChange('installationCompletionDate', e.target.value)} />
                  </FormControl>
                </SimpleGrid>
              </Box>

              <Divider />

              <Box>
                <Heading size="md" mb={4} color="brand.600">
                  Service Ratings <Text as="span" fontSize="sm" color={titleColor} fontWeight="normal">(1 = Poor, 5 = Excellent)</Text>
                </Heading>
                <VStack spacing={4} align="stretch">
                  {ratingFields.map((field) => (
                    <Box key={field.key}>
                      <Text fontWeight="medium" mb={2}>{field.label}</Text>
                      <RadioGroup value={form[field.key as keyof CsaFormState]} onChange={(value) => handleChange(field.key as keyof CsaFormState, value)}>
                        <Stack direction="row" spacing={4} flexWrap="wrap">
                          {ratingOptions.map((option) => (
                            <Radio key={option} value={option}>
                              {option}
                            </Radio>
                          ))}
                        </Stack>
                      </RadioGroup>
                    </Box>
                  ))}
                </VStack>
              </Box>

              <Divider />

              <Box>
                <Heading size="md" mb={4} color="brand.600">
                  Customer Feedback
                </Heading>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel>What did you like about our service?</FormLabel>
                    <Textarea value={form.serviceLikes} onChange={(e) => handleChange('serviceLikes', e.target.value)} rows={4} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Areas where we can improve</FormLabel>
                    <Textarea value={form.improvementAreas} onChange={(e) => handleChange('improvementAreas', e.target.value)} rows={4} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Any issues faced during the project</FormLabel>
                    <Textarea value={form.projectIssues} onChange={(e) => handleChange('projectIssues', e.target.value)} rows={4} />
                  </FormControl>
                </VStack>
              </Box>

              <Divider />

              <Box>
                <Heading size="md" mb={4} color="brand.600">
                  Referral &amp; Testimonial
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Would you recommend us to others?</FormLabel>
                    <RadioGroup value={form.wouldRecommend} onChange={(value) => handleChange('wouldRecommend', value)}>
                      <Stack direction="row" spacing={6}>
                        <Radio value="Yes">Yes</Radio>
                        <Radio value="No">No</Radio>
                      </Stack>
                    </RadioGroup>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Permission to use feedback as testimonial?</FormLabel>
                    <RadioGroup value={form.permissionToUseTestimonial} onChange={(value) => handleChange('permissionToUseTestimonial', value)}>
                      <Stack direction="row" spacing={6}>
                        <Radio value="Yes">Yes</Radio>
                        <Radio value="No">No</Radio>
                      </Stack>
                    </RadioGroup>
                  </FormControl>
                </SimpleGrid>
              </Box>

              <Stack direction={{ base: 'column', md: 'row' }} justify="flex-end">
                <Button type="submit" colorScheme="brand" size="lg">
                  Submit CSA
                </Button>
              </Stack>
            </VStack>
          </Box>
        </CardBody>
      </Card>
    </Box>
  );
};

export default CSA;
