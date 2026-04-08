import React, { useState, useEffect } from 'react';
import {
  Box,
  SimpleGrid,
  Card,
  CardBody,
  Text,
  Flex,
  useColorModeValue,
  HStack,
  Badge,
  Circle,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';
import { formatSupabaseError } from '../utils/error';

interface HeaderStatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  helpText?: string;
}

const HeaderStatsCard: React.FC<HeaderStatsCardProps> = ({ title, value, icon, color, helpText }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const iconBg = useColorModeValue(`${color}.50`, `${color}.900`);
  
  return (
    <Card bg={cardBg} shadow="sm" border="1px solid" borderColor="gray.100" size="sm">
      <CardBody p={4}>
        <Flex justify="space-between" align="center">
          <Box>
            <Text color="gray.600" fontSize="xs" fontWeight="medium" mb={1}>
              {title}
            </Text>
            <Text fontSize="lg" fontWeight="bold" color={`${color}.600`} mb={0}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Text>
            {helpText && (
              <Text color="gray.500" fontSize="xs">
                {helpText}
              </Text>
            )}
          </Box>
          <Circle size="8" bg={iconBg}>
            <Text fontSize="sm" color={`${color}.600`}>{icon}</Text>
          </Circle>
        </Flex>
      </CardBody>
    </Card>
  );
};

const DashboardHeader = () => {
  const [globalStats, setGlobalStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalRevenue: 0,
    totalCapacity: 0,
    chitoorProjects: 0,
  });

  const headerBg = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        // Fetch regular projects
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .neq('status', 'deleted');

        // Fetch Chitoor projects
        const { data: chitoorProjects, error: chitoorError } = await supabase
          .from('chitoor_projects')
          .select('*');

        if (projectsError && projectsError.code !== 'PGRST116') {
          console.error('Error fetching projects:', formatSupabaseError(projectsError));
        }

        if (chitoorError && chitoorError.code !== 'PGRST116') {
          console.error('Error fetching Chitoor projects:', formatSupabaseError(chitoorError));
        }

        if (projects || chitoorProjects) {
          const activeProjects = projects?.filter((p: any) => p.status?.toLowerCase() === 'active').length || 0;
          const completedProjects = projects?.filter((p: any) => p.status?.toLowerCase() === 'completed').length || 0;
          const totalRevenue = projects?.reduce((sum: number, p: any) => sum + (p.proposal_amount || 0), 0) || 0;
          const totalCapacity = projects?.reduce((sum: number, p: any) => sum + (p.kwh || 0), 0) || 0;
          const chitoorTotal = chitoorProjects?.length || 0;

          const chitoorCompleted = (chitoorProjects || []).filter((p: any) => (p.project_status || '').toLowerCase() === 'completed').length;
          const chitoorActive = chitoorTotal - chitoorCompleted;
          const chitoorRevenue = (chitoorProjects || []).reduce((sum: number, p: any) => sum + (p.project_cost || 0), 0);
          const chitoorCapacity = (chitoorProjects || []).reduce((sum: number, p: any) => sum + (p.capacity || 0), 0);

          setGlobalStats({
            totalProjects: (projects?.length || 0) + chitoorTotal,
            activeProjects: activeProjects + chitoorActive,
            completedProjects: completedProjects + chitoorCompleted,
            totalRevenue: totalRevenue + chitoorRevenue,
            totalCapacity: totalCapacity + chitoorCapacity,
            chitoorProjects: chitoorTotal,
          });
        }
      } catch (error) {
        console.error('Error fetching global stats:', formatSupabaseError(error));
      }
    };

    fetchGlobalStats();
  }, []);

  return (
    <Box bg={headerBg} borderBottom="1px solid" borderColor={borderColor} py={4} px={6}>
      <Flex justify="space-between" align="center" mb={4}>
        <Box>
          <HStack spacing={3} align="center">
            <Text fontSize="2xl">🔋</Text>
            <Text fontSize="xl" fontWeight="bold" color="brand.600">
              AXIVOLT GREEN ENERGY
            </Text>
            <Badge colorScheme="brand" px={2} py={1} borderRadius="full" fontSize="xs">
              Dashboard Overview
            </Badge>
          </HStack>
          <Text fontSize="sm" color="gray.600" mt={1}>
            Real-time project analytics across all states
          </Text>
        </Box>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={4}>
        <HeaderStatsCard
          title="Total Projects"
          value={globalStats.totalProjects}
          icon="📊"
          color="blue"
          helpText="All projects"
        />
        <HeaderStatsCard
          title="Active Projects"
          value={globalStats.activeProjects}
          icon="🚀"
          color="brand"
          helpText="In progress"
        />
        <HeaderStatsCard
          title="Completed"
          value={globalStats.completedProjects}
          icon="✅"
          color="purple"
          helpText="Delivered"
        />
        <HeaderStatsCard
          title="Total Revenue"
          value={`₹${(globalStats.totalRevenue / 100000).toFixed(1)}L`}
          icon="💰"
          color="orange"
          helpText="Project value"
        />
        <HeaderStatsCard
          title="Total Capacity"
          value={`${globalStats.totalCapacity.toFixed(2)} kW`}
          icon="⚡"
          color="yellow"
          helpText="Energy capacity"
        />
        <HeaderStatsCard
          title="Chitoor Projects"
          value={globalStats.chitoorProjects}
          icon="🏗️"
          color="teal"
          helpText="District projects"
        />
      </SimpleGrid>
    </Box>
  );
};

export default DashboardHeader;
