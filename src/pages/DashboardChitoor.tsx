import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Text,
  VStack,
  HStack,
  Card,
  CardHeader,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Tooltip,
  Select,
  Flex,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  SimpleGrid,
  useColorModeValue,
  Circle,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Tag,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';
import { CHITOOR_PROJECT_STAGES } from '../lib/constants';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronDownIcon, TimeIcon } from '@chakra-ui/icons';

interface ChitoorProject {
  id: string;
  customer_name: string;
  project_status?: string;
  project_cost: number;
  amount_received?: number;
  capacity: number;
  created_at: string;
  date_of_order: string | null;
}

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  helpText?: string;
  trend?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, helpText, trend }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const iconBg = useColorModeValue(`${color}.50`, `${color}.900`);
  
  return (
    <Card bg={cardBg} shadow="sm" border="1px solid" borderColor="gray.100" _hover={{ shadow: 'md' }} transition="all 0.2s">
      <CardBody>
        <Flex justify="space-between" align="flex-start">
          <Box flex="1">
            <Stat>
              <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">
                {title}
              </StatLabel>
              <StatNumber fontSize="2xl" fontWeight="bold" color={`${color}.600`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </StatNumber>
              {helpText && (
                <StatHelpText color="gray.500" fontSize="xs">
                  {helpText}
                </StatHelpText>
              )}
              {trend && (
                <HStack spacing={1} mt={1}>
                  <Text fontSize="xs" color="green.500">↗️</Text>
                  <Text fontSize="xs" color="green.500" fontWeight="medium">
                    {trend}
                  </Text>
                </HStack>
              )}
            </Stat>
          </Box>
          <Circle size="12" bg={iconBg}>
            <Text fontSize="xl" color={`${color}.600`}>{icon}</Text>
          </Circle>
        </Flex>
      </CardBody>
    </Card>
  );
};

const calculateElapsedTime = (startDateStr: string | null) => {
  if (!startDateStr) return 'N/A';
  const startDate = new Date(startDateStr);
  const currentDate = new Date();
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

const DashboardChitoor = () => {
  const { isAuthenticated, user } = useAuth();
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalRevenue: 0,
    totalKWH: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'stage'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeProjects, setActiveProjects] = useState<ChitoorProject[]>([]);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const isRestrictedUser = user?.email === 'contact@axisogreen.in';
  const cardBg = useColorModeValue('white', 'gray.800');

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const { data: projects, error } = await supabase
        .from('chitoor_projects')
        .select('*');
      if (error) throw error;

      if (projects) {
        const yearProjects = projects.filter((project: ChitoorProject) => {
          const projectDate = new Date(project.date_of_order || project.created_at);
          return projectDate.getFullYear() === selectedYear;
        });

        const completedAll = projects.filter((p: ChitoorProject) => (p.project_status || '').toLowerCase().includes('completed'));
        const activeAll = projects.filter((p: ChitoorProject) => !(p.project_status || '').toLowerCase().includes('completed'));

        const sortedProjects = [...yearProjects].sort((a: ChitoorProject, b: ChitoorProject) => {
          if (sortBy === 'date') {
            const dateA = new Date(a.date_of_order || a.created_at).getTime();
            const dateB = new Date(b.date_of_order || b.created_at).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          } else if (sortBy === 'amount') {
            return sortOrder === 'asc' ? (a.project_cost || 0) - (b.project_cost || 0) : (b.project_cost || 0) - (a.project_cost || 0);
          } else {
            const sa = (a.project_status || '').toLowerCase();
            const sb = (b.project_status || '').toLowerCase();
            return sortOrder === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
          }
        });

        const totalRevenue: number = projects.reduce((sum: number, p: ChitoorProject) => sum + (p.project_cost || 0), 0);
        const totalKWH: number = projects.reduce((sum: number, p: ChitoorProject) => sum + (p.capacity || 0), 0);

        const totalProjectsCount = (projects as ChitoorProject[]).length;

        setStats({
          totalProjects: totalProjectsCount,
          activeProjects: activeAll.length,
          completedProjects: completedAll.length,
          totalRevenue,
          totalKWH,
        });

        const filteredActiveProjects = sortedProjects.filter((p: ChitoorProject) => !(p.project_status || '').toLowerCase().includes('completed'));
        setActiveProjects(filteredActiveProjects);

        const counts: Record<string, number> = {};
        CHITOOR_PROJECT_STAGES.forEach((s) => {
          counts[s] = (projects as any[]).filter((p: any) => (p.project_status || 'pending').toLowerCase() === s.toLowerCase()).length;
        });
        setStatusCounts(counts);
      }
    } catch (e) {
      console.error('Error fetching Chitoor stats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedYear, sortBy, sortOrder]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="70vh">
        <VStack spacing={6}>
          <Text fontSize="6xl" color="green.500">📈</Text>
          <Text fontSize="lg" color="gray.600">Loading Chitoor dashboard...</Text>
          <Progress size="md" isIndeterminate w="300px" colorScheme="green" borderRadius="full" />
        </VStack>
      </Box>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'installation completed':
        return 'green';
      case 'pending':
      case 'material pending':
        return 'yellow';
      case 'in progress':
        return 'blue';
      case 'material sent':
        return 'purple';
      case 'on hold':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Box>
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
          <Box>
            <Heading size="lg" color="gray.800" mb={2}>
              Chitoor Dashboard
            </Heading>
            <Text color="gray.600">District-level analytics and progress</Text>
          </Box>
          <HStack spacing={4} wrap="wrap">
            <Button as={RouterLink as any} to="/reports/chitoor" colorScheme="green" variant="solid" size="sm">View Chitoor Reports</Button>
            <Menu>
              <MenuButton as={Button} rightIcon={<ChevronDownIcon />} variant="outline" size="sm">
                Sort by: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
              </MenuButton>
              <MenuList>
                <MenuItem onClick={() => setSortBy('date')}>Date</MenuItem>
                <MenuItem onClick={() => setSortBy('amount')}>Amount</MenuItem>
                <MenuItem onClick={() => setSortBy('stage')}>Status</MenuItem>
              </MenuList>
            </Menu>
            <Button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} rightIcon={<ChevronDownIcon transform={sortOrder === 'asc' ? 'rotate(180deg)' : 'none'} />} variant="outline" size="sm">
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
            <Select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} width="120px" size="sm">
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </Select>
          </HStack>
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2, lg: isRestrictedUser ? 4 : 5 }} spacing={6}>
          <StatsCard title="Total Projects" value={stats.totalProjects} icon="🏗️" color="blue" helpText="All projects" />
          <StatsCard title="Active Projects" value={stats.activeProjects} icon="📊" color="green" helpText="In progress" />
          <StatsCard title="Completed Projects" value={stats.completedProjects} icon="✅" color="purple" helpText="Successfully delivered" />
          {!isRestrictedUser && (
            <StatsCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon="💰" color="orange" helpText="Project value" />
          )}
          <StatsCard title="Total Capacity" value={`${stats.totalKWH.toLocaleString()} kW`} icon="⚡" color="yellow" helpText="Energy capacity" />
        </SimpleGrid>

       

        <Card bg={cardBg} shadow="sm" border="1px solid" borderColor="gray.100">
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Box>
                <Heading size="md" color="gray.800">Active Projects (Chitoor)</Heading>
                <Text fontSize="sm" color="gray.600" mt={1}>{activeProjects.length} projects currently in progress</Text>
              </Box>
              <Badge colorScheme="green" px={3} py={1} borderRadius="full">Live Data</Badge>
            </Flex>
          </CardHeader>
          <CardBody pt={0}>
            {activeProjects.length > 0 ? (
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">Project ID</Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">Customer</Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">Status</Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">Amount</Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">Capacity</Th>
                    <Th color="gray.600" fontSize="xs" fontWeight="semibold">Duration</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {activeProjects.map((project) => (
                    <Tr key={project.id} _hover={{ bg: 'gray.50' }}>
                      <Td>
                        <Text fontWeight="medium" fontSize="sm">Chitoor-{String(project.id).slice(-6)}</Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" color="gray.700">{project.customer_name}</Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={getStatusColor(project.project_status || '')} borderRadius="full" px={3} py={1} fontSize="xs">{project.project_status || 'Pending'}</Badge>
                      </Td>
                      <Td>
                        <Text fontWeight="medium" fontSize="sm">₹{(project.project_cost || 0).toLocaleString()}</Text>
                      </Td>
                      <Td>
                        <HStack spacing={1}><Text fontSize="xs" color="yellow.500">⚡</Text><Text fontSize="sm">{project.capacity || 'N/A'}</Text></HStack>
                      </Td>
                      <Td>
                        <Tooltip label={project.date_of_order ? `Order on ${new Date(project.date_of_order).toLocaleDateString()}` : 'Using creation date'}>
                          <HStack spacing={1}>
                            <TimeIcon color="gray.400" boxSize={3} />
                            <Text fontSize="sm" color="gray.600">{calculateElapsedTime(project.date_of_order || project.created_at)}</Text>
                          </HStack>
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <Flex direction="column" align="center" py={12}>
                <Text fontSize="6xl" color="gray.300" mb={4}>📊</Text>
                <Text color="gray.500" fontSize="lg" fontWeight="medium">No active projects found</Text>
                <Text color="gray.400" fontSize="sm">Projects will appear here when they are marked as active</Text>
              </Flex>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
};

export default DashboardChitoor;
