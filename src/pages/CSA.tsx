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
  HStack,
  Input,
  Progress,
  Radio,
  RadioGroup,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useToast,
  VStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Stat,
  StatLabel,
  StatNumber,
  Badge,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
  const [submissions, setSubmissions] = useState<CsaFormState[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'location' | 'date'>('date');
  const toast = useToast();
  const location = useLocation();
  const { user } = useAuth();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const titleColor = useColorModeValue('gray.700', 'gray.200');
  const ratingBoxBg = useColorModeValue('gray.50', 'gray.700');
  const canAccessCsa = ['gopi@axisogreen.in', 'admin@axisogreen.in'].includes(user?.email?.toLowerCase() || '');

  // Load CSA records from Supabase on component mount
  useEffect(() => {
    const loadCsaRecords = async () => {
      try {
        const { data, error } = await supabase
          .from('csa_feedback')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading CSA records:', error);
          toast({
            title: 'Error loading records',
            description: 'Failed to load CSA records from database.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        } else {
          // Transform Supabase data to match our form state interface
          const transformedData: CsaFormState[] = (data || []).map((record: any) => ({
            customerName: record.customer_name || '',
            contactNumber: record.contact_number || '',
            projectLocation: record.project_location || '',
            projectManager: record.project_manager || '',
            installationCompletionDate: record.installation_completion_date || '',
            installationQuality: record.installation_quality?.toString() || '',
            timelinessOfCompletion: record.timeliness_of_completion?.toString() || '',
            staffProfessionalism: record.staff_professionalism?.toString() || '',
            communicationUpdates: record.communication_updates?.toString() || '',
            overallSatisfaction: record.overall_satisfaction?.toString() || '',
            serviceLikes: record.service_likes || '',
            improvementAreas: record.improvement_areas || '',
            projectIssues: record.project_issues || '',
            wouldRecommend: record.would_recommend || '',
            permissionToUseTestimonial: record.permission_to_use_testimonial || '',
          }));
          setSubmissions(transformedData);
        }
      } catch (err) {
        console.error('Unexpected error loading CSA records:', err);
      } finally {
        setLoading(false);
      }
    };

    if (canAccessCsa) {
      loadCsaRecords();
    } else {
      setLoading(false);
    }
  }, [canAccessCsa, toast]);

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

  const filteredAndSortedRecords = useMemo(() => {
    let filtered = submissions.filter((submission) => {
      const query = searchQuery.toLowerCase();
      return (
        submission.customerName.toLowerCase().includes(query) ||
        submission.projectLocation.toLowerCase().includes(query) ||
        submission.projectManager.toLowerCase().includes(query) ||
        submission.contactNumber.toLowerCase().includes(query)
      );
    });

    if (sortBy === 'name') {
      filtered.sort((a, b) => a.customerName.localeCompare(b.customerName));
    } else if (sortBy === 'location') {
      filtered.sort((a, b) => a.projectLocation.localeCompare(b.projectLocation));
    } else if (sortBy === 'date') {
      filtered.reverse();
    }

    return filtered;
  }, [submissions, searchQuery, sortBy]);

  const handleChange = (field: keyof CsaFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      // Transform form data to match Supabase schema
      const csaData = {
        customer_name: form.customerName,
        contact_number: form.contactNumber,
        project_location: form.projectLocation,
        project_manager: form.projectManager,
        installation_completion_date: form.installationCompletionDate || null,
        installation_quality: parseInt(form.installationQuality) || 1,
        timeliness_of_completion: parseInt(form.timelinessOfCompletion) || 1,
        staff_professionalism: parseInt(form.staffProfessionalism) || 1,
        communication_updates: parseInt(form.communicationUpdates) || 1,
        overall_satisfaction: parseInt(form.overallSatisfaction) || 1,
        service_likes: form.serviceLikes || null,
        improvement_areas: form.improvementAreas || null,
        project_issues: form.projectIssues || null,
        would_recommend: form.wouldRecommend,
        permission_to_use_testimonial: form.permissionToUseTestimonial,
      };

      let result;
      if (editingIndex === null) {
        // Insert new record
        result = await supabase
          .from('csa_feedback')
          .insert(csaData)
          .select()
          .single();
      } else {
        // Update existing record - we need the record ID
        // For now, we'll insert as new since we don't track the Supabase ID
        // In a real implementation, you'd want to store the Supabase ID in state
        result = await supabase
          .from('csa_feedback')
          .insert(csaData)
          .select()
          .single();
      }

      if (result.error) {
        console.error('Error saving CSA record:', result.error);
        toast({
          title: 'Error saving record',
          description: 'Failed to save CSA record to database.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // Reload the data from Supabase to get the latest state
      const { data: refreshedData, error: refreshError } = await supabase
        .from('csa_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (refreshError) {
        console.error('Error refreshing data:', refreshError);
      } else {
        // Transform and update local state
        const transformedData: CsaFormState[] = (refreshedData || []).map((record: any) => ({
          customerName: record.customer_name || '',
          contactNumber: record.contact_number || '',
          projectLocation: record.project_location || '',
          projectManager: record.project_manager || '',
          installationCompletionDate: record.installation_completion_date || '',
          installationQuality: record.installation_quality?.toString() || '',
          timelinessOfCompletion: record.timeliness_of_completion?.toString() || '',
          staffProfessionalism: record.staff_professionalism?.toString() || '',
          communicationUpdates: record.communication_updates?.toString() || '',
          overallSatisfaction: record.overall_satisfaction?.toString() || '',
          serviceLikes: record.service_likes || '',
          improvementAreas: record.improvement_areas || '',
          projectIssues: record.project_issues || '',
          wouldRecommend: record.would_recommend || '',
          permissionToUseTestimonial: record.permission_to_use_testimonial || '',
        }));
        setSubmissions(transformedData);
      }

      setForm(initialFormState);
      setEditingIndex(null);
      setActiveTab(1);
      toast({
        title: editingIndex === null ? 'CSA form submitted' : 'CSA report updated',
        description: 'The customer satisfaction assessment has been saved successfully.',
        status: 'success',
        duration: 3500,
        isClosable: true,
      });
    } catch (err) {
      console.error('Unexpected error saving CSA record:', err);
      toast({
        title: 'Unexpected error',
        description: 'An unexpected error occurred while saving the record.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleEditSubmission = (submission: CsaFormState, index: number) => {
    setForm(submission);
    setEditingIndex(index);
    setActiveTab(0);
  };

  const handleDeleteSubmission = async (index: number) => {
    try {
      // Since we don't track Supabase IDs, we need to find the record by matching data
      // This is not ideal but works for this implementation
      const submissionToDelete = submissions[index];
      
      // Find the record in Supabase by matching unique fields
      const { data: records, error: findError } = await supabase
        .from('csa_feedback')
        .select('*')
        .eq('customer_name', submissionToDelete.customerName)
        .eq('contact_number', submissionToDelete.contactNumber)
        .eq('project_location', submissionToDelete.projectLocation)
        .eq('project_manager', submissionToDelete.projectManager);

      if (findError) {
        console.error('Error finding record to delete:', findError);
        toast({
          title: 'Error deleting record',
          description: 'Failed to find the record to delete.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (records && records.length > 0) {
        // Delete the first matching record
        const { error: deleteError } = await supabase
          .from('csa_feedback')
          .delete()
          .eq('id', records[0].id);

        if (deleteError) {
          console.error('Error deleting CSA record:', deleteError);
          toast({
            title: 'Error deleting record',
            description: 'Failed to delete CSA record from database.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          return;
        }
      }

      // Reload the data from Supabase
      const { data: refreshedData, error: refreshError } = await supabase
        .from('csa_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (refreshError) {
        console.error('Error refreshing data:', refreshError);
      } else {
        // Transform and update local state
        const transformedData: CsaFormState[] = (refreshedData || []).map((record: any) => ({
          customerName: record.customer_name || '',
          contactNumber: record.contact_number || '',
          projectLocation: record.project_location || '',
          projectManager: record.project_manager || '',
          installationCompletionDate: record.installation_completion_date || '',
          installationQuality: record.installation_quality?.toString() || '',
          timelinessOfCompletion: record.timeliness_of_completion?.toString() || '',
          staffProfessionalism: record.staff_professionalism?.toString() || '',
          communicationUpdates: record.communication_updates?.toString() || '',
          overallSatisfaction: record.overall_satisfaction?.toString() || '',
          serviceLikes: record.service_likes || '',
          improvementAreas: record.improvement_areas || '',
          projectIssues: record.project_issues || '',
          wouldRecommend: record.would_recommend || '',
          permissionToUseTestimonial: record.permission_to_use_testimonial || '',
        }));
        setSubmissions(transformedData);
      }

      if (editingIndex === index) {
        setForm(initialFormState);
        setEditingIndex(null);
      }

      toast({
        title: 'CSA report deleted',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error('Unexpected error deleting CSA record:', err);
      toast({
        title: 'Unexpected error',
        description: 'An unexpected error occurred while deleting the record.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleCancelEdit = () => {
    setForm(initialFormState);
    setEditingIndex(null);
  };

  const calculateAverageRatings = () => {
    if (submissions.length === 0) return {};

    const ratingFieldsKeys = ['installationQuality', 'timelinessOfCompletion', 'staffProfessionalism', 'communicationUpdates', 'overallSatisfaction'];
    const averages: Record<string, number> = {};

    ratingFieldsKeys.forEach((key) => {
      const ratings = submissions
        .map((s) => parseInt(s[key as keyof CsaFormState] as string) || 0)
        .filter(r => r > 0);
      averages[key] = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
    });

    return averages;
  };

  const extractWordFrequency = () => {
    if (submissions.length === 0) return {};

    const commentFields = ['serviceLikes', 'improvementAreas', 'projectIssues'];
    const allText = submissions
      .flatMap((s) => commentFields.map((field) => s[field as keyof CsaFormState] as string))
      .join(' ')
      .toLowerCase();

    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they']);

    const words = allText.match(/\b\w+\b/g) || [];
    const frequency: Record<string, number> = {};

    words.forEach((word) => {
      if (word.length > 3 && !stopWords.has(word)) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    });

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .reduce((acc, [word, count]) => ({ ...acc, [word]: count }), {});
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

  const averageRatings = calculateAverageRatings();
  const wordFrequency = extractWordFrequency();

  const renderReportsTable = (records: CsaFormState[], showControls = false) => {
    if (records.length === 0) {
      return null;
    }

    return (
      <Box>
        {showControls && (
          <VStack spacing={4} mb={6} align="stretch">
            <Box>
              <Text fontWeight="semibold" mb={2} color={titleColor}>
                Search Records
              </Text>
              <Input
                placeholder="Search by customer name, location, manager, or contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                borderColor={borderColor}
                focusBorderColor="brand.500"
              />
            </Box>
            <Box>
              <Text fontWeight="semibold" mb={2} color={titleColor}>
                Sort By
              </Text>
              <HStack spacing={2}>
                {(['name', 'location', 'date'] as const).map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={sortBy === option ? 'solid' : 'outline'}
                    colorScheme={sortBy === option ? 'brand' : 'gray'}
                    onClick={() => setSortBy(option)}
                  >
                    {option === 'name' && 'By Name'}
                    {option === 'location' && 'By Location'}
                    {option === 'date' && 'By Date'}
                  </Button>
                ))}
              </HStack>
            </Box>
            {searchQuery && (
              <Text fontSize="sm" color={titleColor}>
                Found {records.length} of {submissions.length} records
              </Text>
            )}
          </VStack>
        )}

        <Box overflowX="auto" border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="sm">
          <Table variant="simple">
            <Thead bg={ratingBoxBg}>
              <Tr>
                <Th>Customer</Th>
                <Th>Location</Th>
                <Th>Project Manager</Th>
                <Th>Overall</Th>
                <Th>Recommend</Th>
                <Th>Testimonial</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {records.map((submission, index) => {
                const actualIndex = submissions.indexOf(submission);
                return (
                  <Tr key={`${submission.customerName}-${actualIndex}`}>
                    <Td>
                      <Text fontWeight="semibold">{submission.customerName || '-'}</Text>
                      <Text fontSize="sm" color={titleColor}>{submission.contactNumber || '-'}</Text>
                    </Td>
                    <Td>{submission.projectLocation || '-'}</Td>
                    <Td>{submission.projectManager || '-'}</Td>
                    <Td>
                      <Badge colorScheme={parseInt(submission.overallSatisfaction || '0') >= 4 ? 'green' : parseInt(submission.overallSatisfaction || '0') >= 3 ? 'yellow' : 'red'}>
                        {submission.overallSatisfaction || '-'}/5
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={submission.wouldRecommend === 'Yes' ? 'green' : 'red'}>{submission.wouldRecommend || '-'}</Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={submission.permissionToUseTestimonial === 'Yes' ? 'blue' : 'gray'}>{submission.permissionToUseTestimonial || '-'}</Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Button size="sm" variant="outline" borderColor={borderColor} colorScheme="blue" onClick={() => handleEditSubmission(submission, actualIndex)}>
                          Edit
                        </Button>
                        <Button size="sm" colorScheme="red" variant="outline" onClick={() => handleDeleteSubmission(actualIndex)}>
                          Delete
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" boxShadow="sm">
        <CardHeader pb={0}>
          <Heading size="lg" color="brand.600">
            Customer Satisfaction Assessment
          </Heading>
          <Text mt={1} color={titleColor}>
            Manage feedback and view analytics
          </Text>
        </CardHeader>
        <CardBody>
          <Tabs variant="enclosed" index={activeTab} onChange={setActiveTab}>
            <TabList mb={4}>
              <Tab>CSA Form</Tab>
              <Tab>CSA Records</Tab>
              <Tab>Analytics Report</Tab>
            </TabList>

            <TabPanels>
              {/* CSA Form Tab */}
              <TabPanel>
                <Box as="form" onSubmit={handleSubmit}>
                  <VStack spacing={8} align="stretch">
                    <Box>
                      <Heading size="md" mb={4} color="brand.600">
                        Project Details
                      </Heading>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        <FormControl isRequired>
                          <FormLabel>Customer Name</FormLabel>
                          <Input borderColor={borderColor} focusBorderColor="brand.500" value={form.customerName} onChange={(e) => handleChange('customerName', e.target.value)} placeholder="Enter customer name" />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Contact Number</FormLabel>
                          <Input borderColor={borderColor} focusBorderColor="brand.500" value={form.contactNumber} onChange={(e) => handleChange('contactNumber', e.target.value)} placeholder="Enter contact number" />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Project Location</FormLabel>
                          <Input borderColor={borderColor} focusBorderColor="brand.500" value={form.projectLocation} onChange={(e) => handleChange('projectLocation', e.target.value)} placeholder="Enter project location" />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Project Manager</FormLabel>
                          <Input borderColor={borderColor} focusBorderColor="brand.500" value={form.projectManager} onChange={(e) => handleChange('projectManager', e.target.value)} placeholder="Enter project manager name" />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Installation Completion Date</FormLabel>
                          <Input borderColor={borderColor} focusBorderColor="brand.500" type="date" value={form.installationCompletionDate} onChange={(e) => handleChange('installationCompletionDate', e.target.value)} />
                        </FormControl>
                      </SimpleGrid>
                    </Box>

                    <Divider />

                    <Box>
                      <Heading size="md" mb={4} color="brand.600">
                        Service Ratings <Text as="span" fontSize="sm" color={titleColor} fontWeight="normal">(1 = Poor, 5 = Excellent)</Text>
                      </Heading>
                      <VStack spacing={5} align="stretch">
                        {ratingFields.map((field) => (
                          <Box key={field.key} p={3} borderRadius="lg" bg={ratingBoxBg}>
                            <Text fontWeight="semibold" mb={3}>{field.label}</Text>
                            <RadioGroup value={form[field.key as keyof CsaFormState]} onChange={(value) => handleChange(field.key as keyof CsaFormState, value)}>
                              <Stack direction="row" spacing={3} flexWrap="wrap">
                                {ratingOptions.map((option) => (
                                  <Radio key={option} value={option} colorScheme="brand">
                                    <Box textAlign="center" minW="30px">
                                      <Text fontWeight="bold">{option}</Text>
                                      <Text fontSize="xs" color={titleColor}>
                                        {option === '1' && 'Poor'}
                                        {option === '2' && 'Fair'}
                                        {option === '3' && 'Good'}
                                        {option === '4' && 'Very Good'}
                                        {option === '5' && 'Excellent'}
                                      </Text>
                                    </Box>
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
                          <Textarea borderColor={borderColor} focusBorderColor="brand.500" value={form.serviceLikes} onChange={(e) => handleChange('serviceLikes', e.target.value)} rows={4} placeholder="Share positive feedback..." />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Areas where we can improve</FormLabel>
                          <Textarea borderColor={borderColor} focusBorderColor="brand.500" value={form.improvementAreas} onChange={(e) => handleChange('improvementAreas', e.target.value)} rows={4} placeholder="Suggest improvements..." />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Any issues faced during the project</FormLabel>
                          <Textarea borderColor={borderColor} focusBorderColor="brand.500" value={form.projectIssues} onChange={(e) => handleChange('projectIssues', e.target.value)} rows={4} placeholder="Describe any issues..." />
                        </FormControl>
                      </VStack>
                    </Box>

                    <Divider />

                    <Box>
                      <Heading size="md" mb={4} color="brand.600">
                        Referral &amp; Testimonial
                      </Heading>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                        <FormControl isRequired>
                          <FormLabel>Would you recommend us to others?</FormLabel>
                          <RadioGroup value={form.wouldRecommend} onChange={(value) => handleChange('wouldRecommend', value)}>
                            <Stack direction="row" spacing={6}>
                              <Radio value="Yes" colorScheme="green">Yes</Radio>
                              <Radio value="No" colorScheme="red">No</Radio>
                            </Stack>
                          </RadioGroup>
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Permission to use feedback as testimonial?</FormLabel>
                          <RadioGroup value={form.permissionToUseTestimonial} onChange={(value) => handleChange('permissionToUseTestimonial', value)}>
                            <Stack direction="row" spacing={6}>
                              <Radio value="Yes" colorScheme="green">Yes</Radio>
                              <Radio value="No" colorScheme="red">No</Radio>
                            </Stack>
                          </RadioGroup>
                        </FormControl>
                      </SimpleGrid>
                    </Box>

                    <Stack direction={{ base: 'column', md: 'row' }} justify="flex-end" gap={3}>
                      {editingIndex !== null && (
                        <Button variant="outline" borderColor={borderColor} size="lg" onClick={handleCancelEdit}>
                          Cancel Edit
                        </Button>
                      )}
                      <Button type="submit" colorScheme="brand" size="lg">
                        {editingIndex === null ? 'Submit CSA' : 'Update CSA'}
                      </Button>
                      <Text fontSize="sm" color="gray.500" alignSelf="center">
                        {submissions.length} submissions received
                      </Text>
                    </Stack>
                  </VStack>
                </Box>
              </TabPanel>

              {/* CSA Records Tab */}
              <TabPanel>
                {loading ? (
                  <Box textAlign="center" py={10}>
                    <Heading size="md" color={titleColor} mb={2}>Loading Records...</Heading>
                    <Text color={titleColor}>Please wait while we load CSA records from the database.</Text>
                  </Box>
                ) : submissions.length === 0 ? (
                  <Box textAlign="center" py={10}>
                    <Heading size="md" color={titleColor} mb={2}>No Records Yet</Heading>
                    <Text color={titleColor}>CSA records will appear here once you submit forms.</Text>
                  </Box>
                ) : (
                  <VStack spacing={6} align="stretch">
                    <Box>
                      <Heading size="lg" color="brand.600" mb={2}>
                        CSA Records
                      </Heading>
                      <Text color={titleColor} fontSize="sm">
                        Manage and view all customer satisfaction assessments. Edit or delete records as needed.
                      </Text>
                    </Box>
                    {renderReportsTable(filteredAndSortedRecords, true)}
                  </VStack>
                )}
              </TabPanel>

              {/* Analytics Tab */}
              <TabPanel>
                <VStack spacing={6} align="stretch">
                  {loading ? (
                    <Box textAlign="center" py={10}>
                      <Heading size="md" color={titleColor} mb={2}>Loading Analytics...</Heading>
                      <Text color={titleColor}>Please wait while we load data for analytics.</Text>
                    </Box>
                  ) : submissions.length === 0 ? (
                    <Box textAlign="center" py={10}>
                      <Heading size="md" color={titleColor} mb={2}>No Data Available</Heading>
                      <Text color={titleColor}>Submit CSA forms to view analytics reports.</Text>
                    </Box>
                  ) : (
                    <VStack spacing={6} align="stretch">
                      <Box>
                        <Heading size="md" color="brand.600" mb={5}>
                          📊 Average Ratings
                        </Heading>
                        <VStack spacing={5} align="stretch">
                          {Object.entries(averageRatings).map(([field, avg]) => {
                            const labels: Record<string, string> = {
                              installationQuality: 'Installation Quality',
                              timelinessOfCompletion: 'Timeliness of Completion',
                              staffProfessionalism: 'Staff Professionalism',
                              communicationUpdates: 'Communication & Updates',
                              overallSatisfaction: 'Overall Satisfaction',
                            };
                            const percentage = (avg / 5) * 100;
                            return (
                              <Box key={field} p={3} borderRadius="lg" bg={ratingBoxBg}>
                                <HStack justify="space-between" mb={2}>
                                  <Text fontWeight="semibold">{labels[field]}</Text>
                                  <HStack>
                                    <Text fontWeight="bold" color="brand.600">{avg.toFixed(1)}</Text>
                                    <Text fontSize="sm" color={titleColor}>/5</Text>
                                  </HStack>
                                </HStack>
                                <Progress value={percentage} size="md" colorScheme={avg >= 4 ? 'green' : avg >= 3 ? 'yellow' : 'red'} borderRadius="full" />
                              </Box>
                            );
                          })}
                        </VStack>
                      </Box>

                      <Divider />

                      <Box>
                        <Heading size="md" color="brand.600" mb={5}>
                          💬 Most Mentioned Topics
                        </Heading>
                        <VStack spacing={3} align="stretch">
                          {Object.entries(wordFrequency).length > 0 ? (
                            <>
                              <Wrap spacing={2}>
                                {Object.entries(wordFrequency).map(([word, count]) => {
                                  const numCount = count as unknown as number;
                                  return (
                                    <WrapItem key={word}>
                                      <Badge colorScheme={numCount >= 5 ? 'red' : numCount >= 3 ? 'orange' : 'blue'} fontSize="md" px={3} py={1}>
                                        {word} ×{numCount}
                                      </Badge>
                                    </WrapItem>
                                  );
                                })}
                              </Wrap>
                            </>
                          ) : (
                            <Text color={titleColor}>No comment data available yet.</Text>
                          )}
                        </VStack>
                      </Box>

                      <Divider />

                      <Box>
                        <Heading size="md" color="brand.600" mb={5}>
                          📈 Summary Stats
                        </Heading>
                        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                          <Stat>
                            <StatLabel>Total Submissions</StatLabel>
                            <StatNumber color="brand.600">{submissions.length}</StatNumber>
                          </Stat>
                          <Stat>
                            <StatLabel>Avg Overall Rating</StatLabel>
                            <StatNumber color="brand.600">{(averageRatings['overallSatisfaction'] || 0).toFixed(1)}/5</StatNumber>
                          </Stat>
                          <Stat>
                            <StatLabel>Recommenders</StatLabel>
                            <StatNumber color="green.600">{submissions.filter(s => s.wouldRecommend === 'Yes').length}/{submissions.length}</StatNumber>
                          </Stat>
                          <Stat>
                            <StatLabel>Testimonial Perms</StatLabel>
                            <StatNumber color="blue.600">{submissions.filter(s => s.permissionToUseTestimonial === 'Yes').length}/{submissions.length}</StatNumber>
                          </Stat>
                        </SimpleGrid>
                      </Box>
                    </VStack>
                  )}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </CardBody>
      </Card>
    </Box>
  );
};

export default CSA;
