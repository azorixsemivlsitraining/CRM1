import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  SimpleGrid,
  Card,
  CardBody,
  useColorModeValue,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';
import Projects from '../components/Projects';

interface Project {
  id: string;
  name: string;
  customer_name: string;
  state: string;
  status: string;
  current_stage: string;
  proposal_amount: number;
  created_at: string;
  start_date: string;
  kwh: number;
}

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  helpText?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, helpText }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const iconBg = useColorModeValue(`${color}.50`, `${color}.900`);
  
  return (
    <Card bg={cardBg} shadow="sm" border="1px solid" borderColor="gray.100">
      <CardBody>
        <Box display="flex" alignItems="center" gap={4}>
          <Box
            w="12"
            h="12"
            bg={iconBg}
            borderRadius="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="xl"
            color={`${color}.600`}
          >
            {icon}
          </Box>
          <Box>
            <Text color="gray.600" fontSize="sm" fontWeight="medium">
              {title}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={`${color}.600`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Text>
            {helpText && (
              <Text color="gray.500" fontSize="xs">
                {helpText}
              </Text>
            )}
          </Box>
        </Box>
      </CardBody>
    </Card>
  );
};

const APProjects = () => {
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalRevenue: 0,
    totalCapacity: 0,
  });

  const fetchAPStats = useCallback(async () => {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .ilike('state', '%andhra pradesh%')
        .neq('status', 'deleted');

      if (error) {
        console.error('Error fetching AP projects:', error);
        return;
      }

      if (projects) {
        const activeProjects = projects.filter((p: Project) => 
          p.status?.toLowerCase() === 'active'
        );
        const completedProjects = projects.filter((p: Project) => 
          p.status?.toLowerCase() === 'completed'
        );
        const totalRevenue = projects.reduce((sum: number, p: Project) => 
          sum + (p.proposal_amount || 0), 0
        );
        const totalCapacity = projects.reduce((sum: number, p: Project) => 
          sum + (p.kwh || 0), 0
        );

        setStats({
          totalProjects: projects.length,
          activeProjects: activeProjects.length,
          completedProjects: completedProjects.length,
          totalRevenue,
          totalCapacity,
        });
      }
    } catch (error) {
      console.error('Error fetching AP stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchAPStats();
  }, [fetchAPStats]);

  return (
    <Box>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" color="gray.800" mb={2}>
            AP Projects Dashboard
          </Heading>
          <Text color="gray.600">
            Overview and management of all Andhra Pradesh (AP) state projects
          </Text>
        </Box>

        {/* Stats Cards */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={6}>
          <StatsCard
            title="Total Projects"
            value={stats.totalProjects}
            icon="📋"
            color="blue"
            helpText="All AP projects"
          />
          <StatsCard
            title="Active Projects"
            value={stats.activeProjects}
            icon="🚀"
            color="green"
            helpText="In progress"
          />
          <StatsCard
            title="Completed Projects"
            value={stats.completedProjects}
            icon="✅"
            color="purple"
            helpText="Successfully delivered"
          />
          <StatsCard
            title="Total Revenue"
            value={`₹${stats.totalRevenue.toLocaleString()}`}
            icon="💰"
            color="orange"
            helpText="Project value"
          />
          <StatsCard
            title="Total Capacity"
            value={`${stats.totalCapacity.toLocaleString()} kW`}
            icon="⚡"
            color="yellow"
            helpText="Energy capacity"
          />
        </SimpleGrid>

        {/* Projects Component with AP filter */}
        <Projects stateFilter="Andhra Pradesh" />
      </VStack>
    </Box>
  );
};

export default APProjects;
