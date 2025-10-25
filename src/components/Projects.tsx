import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  CloseButton,
  FormControl,
  FormLabel,
  Input,
  VStack,
  TableContainer,
  Select,
  Badge,
  useToast,
  HStack,
  Text,
  Tooltip,
  Flex,
  Heading,
  InputGroup,
  InputLeftElement,
  Card,
  CardBody,
  SimpleGrid,
  useColorModeValue,
  IconButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Stack,
  MenuButton,
  Menu,
  MenuList,
  MenuItem,
  Portal,
  Stat,
  StatLabel,
  StatNumber,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatSupabaseError } from '../utils/error';
import {
  AddIcon,
  SearchIcon,
  SettingsIcon,
  ViewIcon,
  DeleteIcon,
  CheckCircleIcon,
  CloseIcon,
  TimeIcon,
  ChevronDownIcon,
  EmailIcon,
  PhoneIcon,
  EditIcon,
} from '@chakra-ui/icons';

interface Project {
  id: string;
  name: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  project_type: 'DCR' | 'Non DCR';
  payment_mode: 'Loan' | 'Cash' | 'UPI' | 'Cheque' | 'Subsidy';
  proposal_amount: number;
  advance_payment: number;
  balance_amount: number;
  status: string;
  current_stage: string;
  start_date: string;
  kwh: number;
}

// Define filter structure
interface FilterOptions {
  field: string;
  value: string;
}

export interface ProjectsProps {
  stateFilter?: string;
}

// Utility function to calculate elapsed time since start date
const calculateElapsedTime = (startDateStr: string | null) => {
  if (!startDateStr) return 'N/A';
  
  const startDate = new Date(startDateStr);
  const currentDate = new Date();
  
  // Check for invalid date
  if (isNaN(startDate.getTime())) return 'N/A';
  
  const diffTime = Math.abs(currentDate.getTime() - startDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return '1 day';
  if (diffDays < 7) return `${diffDays} days`;
  
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return '1 week';
  if (diffWeeks < 4) return `${diffWeeks} weeks`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month';
  if (diffMonths < 12) return `${diffMonths} months`;
  
  const diffYears = Math.floor(diffDays / 365);
  if (diffYears === 1) return '1 year';
  return `${diffYears} years`;
};

// State mapping function to convert abbreviations to full names
const mapStateToFullName = (state: string): string => {
  const stateMapping: Record<string, string> = {
    'TG': 'Telangana',
    'AP': 'Andhra Pradesh'
  };
  return stateMapping[state] || state;
};

const Projects: React.FC<ProjectsProps> = ({ stateFilter }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const { isAdmin, assignedRegions } = useAuth();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();
  const [newProject, setNewProject] = useState({
    name: '',
    customer_name: '',
    email: '',
    phone: '',
    address: '',
    state: 'TG',
    project_type: 'DCR',
    payment_mode: 'Cash',
    proposal_amount: '',
    advance_payment: '',
    loan_amount: '',
    start_date: '',
    kwh: '',
  });
  const [loading, setLoading] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [combinedTotals, setCombinedTotals] = useState({ totalProjects: 0, totalRevenue: 0, totalKWH: 0, active: 0, completed: 0 });
  const [activeFilters, setActiveFilters] = useState<FilterOptions[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();

  // Filter modal state
  const { 
    isOpen: isFilterOpen, 
    onOpen: onFilterOpen, 
    onClose: onFilterClose 
  } = useDisclosure();
  const [filterField, setFilterField] = useState<string>('');
  const [filterValue, setFilterValue] = useState<string>('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const parseNumber = (value: any) => (typeof value === 'number' ? value : parseFloat(value || '0') || 0);

      let query = supabase
        .from('projects')
        .select('*')
        .neq('status', 'deleted');

      if (!isAdmin && Array.isArray(assignedRegions) && assignedRegions.length > 0) {
        query = (query as any).in('state', assignedRegions);
      }

      if (stateFilter) {
        query = query.ilike('state', `%${stateFilter}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', (error as any)?.message || error, error);
        toast({
          title: 'Error',
          description: `Failed to fetch projects. ${formatSupabaseError(error)}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setCombinedTotals({ totalProjects: 0, totalRevenue: 0, totalKWH: 0, active: 0, completed: 0 });
        return;
      }

      const primaryProjects = Array.isArray(data) ? (data as Project[]) : [];
      setAllProjects(primaryProjects);
      setProjects(primaryProjects);

      const primaryTotals = {
        count: primaryProjects.length,
        revenue: primaryProjects.reduce((sum, project) => sum + parseNumber(project.proposal_amount), 0),
        kwh: primaryProjects.reduce((sum, project) => sum + parseNumber(project.kwh), 0),
        active: primaryProjects.filter(p => (p.status || '').toLowerCase() === 'active').length,
        completed: primaryProjects.filter(p => (p.status || '').toLowerCase() === 'completed').length,
      };

      const canIncludeChitoor = !stateFilter && (isAdmin || !Array.isArray(assignedRegions) || assignedRegions.length === 0 || assignedRegions.includes('Chitoor'));

      let chitoorTotals = { count: 0, revenue: 0, kwh: 0, active: 0, completed: 0 };
      if (canIncludeChitoor) {
        const { data: chitoorData, error: chErr } = await supabase.from('chitoor_projects').select('project_cost, capacity, project_status');
        if (!chErr || (chErr as any)?.code === 'PGRST116') {
          const rows = Array.isArray(chitoorData) ? chitoorData : [];
          const isCompleted = (s: any) => {
            const v = String(s || '').toLowerCase();
            return v === 'completed' || v.includes('installation completed') || v.includes('commissioned') || v.includes('delivered');
          };
          const isInactive = (s: any) => {
            const v = String(s || '').toLowerCase();
            return v.includes('cancel') || v.includes('declined') || v.includes('rejected') || v.includes('closed');
          };
          const completed = rows.filter(r => isCompleted((r as any).project_status)).length;
          const inactive = rows.filter(r => isInactive((r as any).project_status)).length;
          chitoorTotals = {
            count: rows.length,
            revenue: rows.reduce((sum, row) => sum + parseNumber((row as any).project_cost), 0),
            kwh: rows.reduce((sum, row) => sum + parseNumber((row as any).capacity), 0),
            active: Math.max(0, rows.length - completed - inactive),
            completed,
          };
        } else {
          console.warn('Chitoor projects fetch error:', chErr);
        }
      }

      setCombinedTotals({
        totalProjects: primaryTotals.count + (canIncludeChitoor ? chitoorTotals.count : 0),
        totalRevenue: primaryTotals.revenue + (canIncludeChitoor ? chitoorTotals.revenue : 0),
        totalKWH: primaryTotals.kwh + (canIncludeChitoor ? chitoorTotals.kwh : 0),
        active: primaryTotals.active + (canIncludeChitoor ? chitoorTotals.active : 0),
        completed: primaryTotals.completed + (canIncludeChitoor ? chitoorTotals.completed : 0),
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch projects. ${formatSupabaseError(error)}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setCombinedTotals({ totalProjects: 0, totalRevenue: 0, totalKWH: 0, active: 0, completed: 0 });
    } finally {
      setLoading(false);
    }
  }, [toast, stateFilter, isAdmin, assignedRegions]);

  useEffect(() => {
    fetchProjects();
    const chPr = (supabase as any)
      .channel('realtime-projects-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchProjects())
      .subscribe();
    const chCh = (supabase as any)
      .channel('realtime-chitoor-projects-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chitoor_projects' }, () => fetchProjects())
      .subscribe();
    return () => {
      try { (chPr as any)?.unsubscribe?.(); } catch {}
      try { (chCh as any)?.unsubscribe?.(); } catch {}
    };
  }, [fetchProjects]);

  // Apply filters and search whenever activeFilters or searchTerm changes
  const applyFilters = useCallback(() => {
    let filtered = allProjects;
    if (activeFilters.length > 0) {
      filtered = filtered.filter(project => {
        return activeFilters.every(filter => {
          const projectValue = String(project[filter.field as keyof Project] || '').toLowerCase();
          return projectValue.includes(filter.value.toLowerCase());
        });
      });
    }
    if (searchTerm.trim() !== '') {
      const keyword = searchTerm.toLowerCase();
      filtered = filtered.filter(project =>
        Object.values(project).some(val =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(keyword)
        )
      );
    }
    setProjects(filtered);
  }, [activeFilters, allProjects, searchTerm]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Get available values for a field
  const getFieldOptions = (field: string): string[] => {
    if (!field) return [];

    // Get unique values from the projects using a simple object to track uniqueness
    const uniqueValuesMap: Record<string, boolean> = {};
    
    allProjects.forEach(project => {
      const value = project[field as keyof Project];
      if (value !== null && value !== undefined) {
        uniqueValuesMap[String(value)] = true;
      }
    });

    return Object.keys(uniqueValuesMap);
  };

  // Render the appropriate input based on selected field
  const renderFilterValueInput = () => {
    if (!filterField) return (
      <Input
        value={filterValue}
        onChange={(e) => setFilterValue(e.target.value)}
        placeholder="Select a field first"
        isDisabled={!filterField}
      />
    );

    // Fields with predefined options
    if (['status', 'project_type', 'payment_mode', 'current_stage'].includes(filterField)) {
      const options = getFieldOptions(filterField);
      
      return (
        <Select
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          placeholder={`Select ${filterField}`}
        >
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
      );
    }

    // Default text input for other fields
    return (
      <Input
        value={filterValue}
        onChange={(e) => setFilterValue(e.target.value)}
        placeholder="Enter filter value"
      />
    );
  };

  // Add new filter
  const addFilter = () => {
    if (!filterField || !filterValue) {
      toast({
        title: 'Filter Error',
        description: 'Please select both a field and value to filter by',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setActiveFilters(prev => [...prev, { field: filterField, value: filterValue }]);
    setFilterField('');
    setFilterValue('');
    onFilterClose();
  };

  // Remove a filter
  const removeFilter = (index: number) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewProject(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const startDate = newProject.start_date 
        ? new Date(newProject.start_date).toISOString() 
        : new Date().toISOString();
        
      const proposal = parseFloat(newProject.proposal_amount);
      const advance = parseFloat(newProject.advance_payment);
      const loan = parseFloat(newProject.loan_amount || '0');
      
      const projectData = {
        name: newProject.name,
        customer_name: newProject.customer_name,
        email: newProject.email,
        phone: newProject.phone,
        address: newProject.address,
        state: mapStateToFullName(newProject.state),
        project_type: newProject.project_type,
        payment_mode: newProject.payment_mode,
        proposal_amount: proposal,
        advance_payment: advance,
        loan_amount: loan,
        paid_amount: 0,
        status: 'active',
        current_stage: 'Advance payment done',
        start_date: startDate,
        kwh: parseFloat(newProject.kwh),
      };

      const { error } = await supabase
        .from('projects')
        .insert([projectData]);

      if (error) {
        console.error('Supabase error:', (error as any)?.message || error, error);
        toast({
          title: 'Error',
          description: `Failed to create project. ${formatSupabaseError(error)}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Project created successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      onClose();
      setNewProject({
        name: '',
        customer_name: '',
        email: '',
        phone: '',
        address: '',
        state: 'TG',
        project_type: 'DCR',
        payment_mode: 'Cash',
        proposal_amount: '',
        advance_payment: '',
        loan_amount: '',
        start_date: '',
        kwh: '',
      });
      fetchProjects();
    } catch (error) {
      console.error('Error creating project:', error);
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

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'deleted' })
        .eq('id', projectId);

      if (error) {
        throw error;
      }

      setProjects(prevProjects => prevProjects.filter(project => project.id !== projectId));

      toast({
        title: 'Success',
        description: 'Project deleted successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete project. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const toggleProjectStatus = async (projectId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'completed' : 'active';
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId);

      if (error) {
        throw error;
      }

      setProjects(prevProjects => 
        prevProjects.map(project => 
          project.id === projectId 
            ? { ...project, status: newStatus }
            : project
        )
      );

      toast({
        title: 'Success',
        description: `Project marked as ${newStatus}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

    } catch (error) {
      console.error('Error updating project status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update project status. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'green';
      case 'completed': return 'blue';
      case 'pending': return 'yellow';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  };

  const getProjectTypeColor = (type: string) => {
    return type === 'DCR' ? 'green' : 'blue';
  };

  const totalProjectsCount = allProjects.length;
  const activeCount = stateFilter ? allProjects.filter(p => (p.status || '').toLowerCase() === 'active').length : (combinedTotals.active || 0);
  const completedCount = stateFilter ? allProjects.filter(p => (p.status || '').toLowerCase() === 'completed').length : (combinedTotals.completed || 0);

  const StatTile: React.FC<{ title: string; value: number; icon: string; help?: string }> = ({ title, value, icon, help }) => {
    const tileBg = cardBg;
    return (
      <Card bg={tileBg} border="1px solid" borderColor={borderColor}>
        <CardBody>
          <Flex justify="space-between" align="flex-start">
            <Box>
              <Stat>
                <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">{title}</StatLabel>
                <StatNumber fontSize="2xl" color="green.600">{value.toLocaleString()}</StatNumber>
                {help && <Text fontSize="xs" color="gray.500">{help}</Text>}
              </Stat>
            </Box>
            <Text fontSize="xl">{icon}</Text>
          </Flex>
        </CardBody>
      </Card>
    );
  };

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
          <HStack spacing={3} align="center">
            <Button variant="outline" size="sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/welcome'))}>← Back</Button>
            <Box>
              <Heading size="lg" color="gray.800" mb={2}>
                {stateFilter ? `${stateFilter} Projects` : 'Projects Management'}
              </Heading>
              <Text color="gray.600">
                {projects.length} of {stateFilter ? allProjects.length : (combinedTotals.totalProjects || allProjects.length)} projects
                {stateFilter && ` in ${stateFilter}`}
              </Text>
            </Box>
          </HStack>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="green"
            onClick={onOpen}
            size="lg"
            borderRadius="lg"
            _hover={{ transform: 'translateY(-1px)', boxShadow: 'lg' }}
            transition="all 0.2s"
          >
            Create New Project
          </Button>
        </Flex>

        {/* Analytics cards */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          <StatTile title="All projects" value={stateFilter ? totalProjectsCount : (combinedTotals.totalProjects || totalProjectsCount)} icon="📁" help="Total Projects" />
          <StatTile title="In progress" value={activeCount} icon="📈" help="Active Projects" />
          <StatTile title="Successfully delivered" value={completedCount} icon="✅" help="Completed Projects" />
        </SimpleGrid>

        {/* Search and Filter Bar */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
          <CardBody>
            <Stack spacing={4}>
              <Flex gap={4} wrap="wrap">
                <InputGroup flex="1" minW="300px">
                  <InputLeftElement>
                    <SearchIcon color="gray.400" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search projects by any keyword..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    bg="gray.50"
                    border="1px solid"
                    borderColor="gray.200"
                    _focus={{ bg: 'white', borderColor: 'green.400' }}
                  />
                </InputGroup>
                <Button
                  leftIcon={<SettingsIcon />}
                  onClick={onFilterOpen}
                  variant="outline"
                  borderColor="green.300"
                  color="green.600"
                  _hover={{ bg: 'green.50' }}
                >
                  Filter
                </Button>
                {activeFilters.length > 0 && (
                  <Button
                    variant="outline"
                    colorScheme="red"
                    onClick={clearAllFilters}
                    size="md"
                  >
                    Clear Filters ({activeFilters.length})
                  </Button>
                )}
              </Flex>

              {/* Active Filters */}
              {activeFilters.length > 0 && (
                <Box>
                  <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={2}>
                    Active Filters:
                  </Text>
                  <Flex gap={2} wrap="wrap">
                    {activeFilters.map((filter, index) => (
                      <Badge
                        key={index}
                        colorScheme="green"
                        px={3}
                        py={1}
                        borderRadius="full"
                        display="flex"
                        alignItems="center"
                        gap={1}
                      >
                        {filter.field}: {filter.value}
                        <IconButton
                          size="xs"
                          onClick={() => removeFilter(index)}
                          variant="ghost"
                          aria-label="Remove filter"
                          icon={<Text fontSize="xs">×</Text>}
                          _hover={{ bg: 'green.600' }}
                        />
                      </Badge>
                    ))}
                  </Flex>
                </Box>
              )}
            </Stack>
          </CardBody>
        </Card>

        {/* Projects Table */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
          <CardBody p={0}>
            {projects.length > 0 ? (
              <TableContainer overflowX={{ base: 'auto', md: 'hidden' }} sx={{ '&::-webkit-scrollbar': { height: '6px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: '3px' } }}>
                <Table variant="simple" size="sm">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th fontWeight="semibold" color="gray.700">Project Details</Th>
                      <Th fontWeight="semibold" color="gray.700">Customer Info</Th>
                      <Th fontWeight="semibold" color="gray.700">Financial</Th>
                      <Th fontWeight="semibold" color="gray.700">Timeline</Th>
                      <Th fontWeight="semibold" color="gray.700">Status</Th>
                      <Th fontWeight="semibold" color="gray.700">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {projects.map(project => (
                      <Tr key={project.id} _hover={{ bg: 'gray.50' }} transition="all 0.2s">
                        <Td>
                          <VStack align="start" spacing={1}>
                            <Text fontWeight="medium" fontSize="sm" cursor="pointer" 
                                  onClick={() => navigate(`/projects/${project.id}`)}>
                              {project.name}
                            </Text>
                            <HStack spacing={2}>
                              <Badge colorScheme={getProjectTypeColor(project.project_type)} size="sm">
                                {project.project_type}
                              </Badge>
                              <Badge variant="outline" size="sm">
                                {project.payment_mode}
                              </Badge>
                            </HStack>
                            <HStack spacing={1}>
                              <Text fontSize="xs" color="yellow.500">⚡</Text>
                              <Text fontSize="xs" color="gray.600">
                                {project.kwh || 'N/A'} kW
                              </Text>
                            </HStack>
                          </VStack>
                        </Td>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <HStack spacing={1}>
                              <Text fontSize="xs" color="gray.400">👤</Text>
                              <Text fontSize="sm" fontWeight="medium">
                                {project.customer_name}
                              </Text>
                            </HStack>
                            <HStack spacing={1}>
                              <PhoneIcon color="gray.400" boxSize={3} />
                              <Text fontSize="xs" color="gray.600">
                                {project.phone}
                              </Text>
                            </HStack>
                            <HStack spacing={1}>
                              <EmailIcon color="gray.400" boxSize={3} />
                              <Text fontSize="xs" color="gray.600" isTruncated maxW="150px">
                                {project.email}
                              </Text>
                            </HStack>
                          </VStack>
                        </Td>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <HStack spacing={1}>
                              <Text fontSize="xs" color="green.500">₹</Text>
                              <Text fontSize="sm" fontWeight="bold" color="green.600">
                                ₹{project.proposal_amount.toLocaleString()}
                              </Text>
                            </HStack>
                            <Text fontSize="xs" color="gray.600">
                              Advance: ₹{project.advance_payment.toLocaleString()}
                            </Text>
                            <Text fontSize="xs" color="red.500">
                              Balance: ₹{project.balance_amount.toLocaleString()}
                            </Text>
                          </VStack>
                        </Td>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <Text fontSize="xs" color="gray.600">
                              {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'Not set'}
                            </Text>
                            <Tooltip label={project.start_date ? `Project started on ${new Date(project.start_date).toLocaleDateString()}` : 'Start date not set'}>
                              <HStack spacing={1}>
                                <TimeIcon color="gray.400" boxSize={3} />
                                <Text fontSize="xs" color="gray.600">
                                  {calculateElapsedTime(project.start_date)}
                                </Text>
                              </HStack>
                            </Tooltip>
                            <Text fontSize="xs" color="blue.600" fontWeight="medium">
                              {project.current_stage}
                            </Text>
                          </VStack>
                        </Td>
                        <Td>
                          <Badge 
                            colorScheme={getStatusColor(project.status)} 
                            px={3} 
                            py={1} 
                            borderRadius="full"
                            fontSize="xs"
                          >
                            {project.status}
                          </Badge>
                        </Td>
                        <Td>
                          <Menu>
                            <MenuButton
                              as={IconButton}
                              icon={<ChevronDownIcon />}
                              variant="ghost"
                              size="sm"
                            />
                            <Portal>
                              <MenuList>
                                
                                <MenuItem
                                  icon={<ViewIcon />}
                                  onClick={() => navigate(`/projects/${project.id}`)}
                                >
                                  View Details
                                </MenuItem>
                                <MenuItem
                                  icon={project.status === 'active' ? <CheckCircleIcon /> : <CloseIcon />}
                                  onClick={() => toggleProjectStatus(project.id, project.status)}
                                >
                                  Mark {project.status === 'active' ? 'Complete' : 'Active'}
                                </MenuItem>
                                <MenuItem
                                  icon={<DeleteIcon />}
                                  color="red.500"
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
                                      deleteProject(project.id);
                                    }
                                  }}
                                >
                                  Delete Project
                                </MenuItem>
                              </MenuList>
                            </Portal>
                          </Menu>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            ) : (
              <Flex direction="column" align="center" py={16}>
                <Text fontSize="6xl" color="gray.300" mb={4}>📊</Text>
                <Text color="gray.500" fontSize="lg" fontWeight="medium" mb={2}>
                  {searchTerm || activeFilters.length > 0 ? 'No projects match your filters' : 'No projects found'}
                </Text>
                <Text color="gray.400" fontSize="sm" mb={6}>
                  {searchTerm || activeFilters.length > 0 
                    ? 'Try adjusting your search or filter criteria' 
                    : 'Create your first project to get started'
                  }
                </Text>
                {(!searchTerm && activeFilters.length === 0) && (
                  <Button
                    leftIcon={<AddIcon />}
                    colorScheme="green"
                    onClick={onOpen}
                  >
                    Create New Project
                  </Button>
                )}
              </Flex>
            )}
          </CardBody>
        </Card>
      </VStack>

      {/* Filter Modal */}
      <Modal isOpen={isFilterOpen} onClose={onFilterClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex align="center" gap={2}>
              <SettingsIcon color="green.500" />
              Filter Projects
            </Flex>
          </ModalHeader>
          <CloseButton position="absolute" right={2} top={2} onClick={onFilterClose} />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <Alert status="info" borderRadius="lg">
                <AlertIcon />
                <Box>
                  <AlertTitle fontSize="sm">Filter Projects</AlertTitle>
                  <AlertDescription fontSize="xs">
                    Select a field and value to filter the projects. You can add multiple filters.
                  </AlertDescription>
                </Box>
              </Alert>
              
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="medium">Filter By</FormLabel>
                <Select
                  value={filterField}
                  onChange={(e) => {
                    setFilterField(e.target.value);
                    setFilterValue('');
                  }}
                  placeholder="Select field to filter by"
                >
                  <option value="name">Project Name</option>
                  <option value="customer_name">Customer Name</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="address">Address</option>
                  <option value="project_type">Project Type</option>
                  <option value="payment_mode">Payment Mode</option>
                  <option value="status">Status</option>
                  <option value="current_stage">Current Stage</option>
                  <option value="kwh">KWH</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="medium">Value</FormLabel>
                {renderFilterValueInput()}
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {filterField === 'status' ? 
                    'Filter by project status (active/completed)' : 
                    filterField === 'project_type' ? 
                    'Filter by DCR or Non DCR projects' :
                    filterField === 'payment_mode' ?
                    'Filter by Cash or Loan payment mode' :
                    'Enter text to filter (case insensitive)'}
                </Text>
              </FormControl>

              <Button 
                colorScheme="green" 
                width="full" 
                onClick={addFilter}
                isDisabled={!filterField || !filterValue}
                leftIcon={<SettingsIcon />}
              >
                Apply Filter
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Create Project Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex align="center" gap={2}>
              <AddIcon color="green.500" />
              Create New Project
            </Flex>
          </ModalHeader>
          <CloseButton position="absolute" right={2} top={2} onClick={onClose} />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="full">
                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Project Name</FormLabel>
                  <Input
                    name="name"
                    value={newProject.name}
                    onChange={handleInputChange}
                    placeholder="Enter project name"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Customer Name</FormLabel>
                  <Input
                    name="customer_name"
                    value={newProject.customer_name}
                    onChange={handleInputChange}
                    placeholder="Enter customer name"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Email</FormLabel>
                  <Input
                    name="email"
                    type="email"
                    value={newProject.email}
                    onChange={handleInputChange}
                    placeholder="customer@example.com"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Phone</FormLabel>
                  <Input
                    name="phone"
                    value={newProject.phone}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Address</FormLabel>
                  <Input
                    name="address"
                    value={newProject.address}
                    onChange={handleInputChange}
                    placeholder="Customer address"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">State</FormLabel>
                  <Select
                    name="state"
                    value={newProject.state}
                    onChange={(e) => setNewProject(prev => ({
                      ...prev,
                      state: e.target.value
                    }))}
                  >
                    <option value="TG">TG (Telangana)</option>
                    <option value="AP">AP (Andhra Pradesh)</option>
                    <option disabled>─────────────</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                    <option value="Assam">Assam</option>
                    <option value="Bihar">Bihar</option>
                    <option value="Chhattisgarh">Chhattisgarh</option>
                    <option value="Goa">Goa</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Himachal Pradesh">Himachal Pradesh</option>
                    <option value="Jharkhand">Jharkhand</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Manipur">Manipur</option>
                    <option value="Meghalaya">Meghalaya</option>
                    <option value="Mizoram">Mizoram</option>
                    <option value="Nagaland">Nagaland</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Sikkim">Sikkim</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Tripura">Tripura</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Uttarakhand">Uttarakhand</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Chandigarh">Chandigarh</option>
                    <option value="Puducherry">Puducherry</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="medium">Project Start Date</FormLabel>
                  <Input
                    name="start_date"
                    type="date"
                    value={newProject.start_date}
                    onChange={handleInputChange}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Project Type</FormLabel>
                  <Select
                    name="project_type"
                    value={newProject.project_type}
                    onChange={(e) => setNewProject(prev => ({
                      ...prev,
                      project_type: e.target.value
                    }))}
                  >
                    <option value="DCR">DCR</option>
                    <option value="Non DCR">Non DCR</option>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Payment Mode</FormLabel>
                  <Select
                    name="payment_mode"
                    value={newProject.payment_mode}
                    onChange={(e) => setNewProject(prev => ({
                      ...prev,
                      payment_mode: e.target.value
                    }))}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Loan">Loan</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Total Amount (₹)</FormLabel>
                  <Input
                    name="proposal_amount"
                    type="number"
                    value={newProject.proposal_amount}
                    onChange={handleInputChange}
                    placeholder="0"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Advance Payment (₹)</FormLabel>
                  <Input
                    name="advance_payment"
                    type="number"
                    value={newProject.advance_payment}
                    onChange={handleInputChange}
                    max={newProject.proposal_amount}
                    placeholder="0"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="medium">Loan Amount (₹)</FormLabel>
                  <Input
                    name="loan_amount"
                    type="number"
                    value={newProject.loan_amount}
                    onChange={handleInputChange}
                    max={newProject.proposal_amount}
                    placeholder="0"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium">Capacity (kW)</FormLabel>
                  <Input
                    name="kwh"
                    type="number"
                    value={newProject.kwh}
                    onChange={handleInputChange}
                    placeholder="0"
                  />
                </FormControl>
              </SimpleGrid>

              <Divider />

              <Button 
                colorScheme="green" 
                width="full" 
                onClick={handleSubmit}
                isLoading={loading}
                loadingText="Creating..."
                leftIcon={<AddIcon />}
                size="lg"
              >
                Create Project
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Projects;
