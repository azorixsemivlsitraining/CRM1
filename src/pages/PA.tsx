import React from 'react';
import {
  Box,
  Heading,
  VStack,
} from '@chakra-ui/react';
import ProjectAnalysisForm from '../components/ProjectAnalysisForm';

const PA: React.FC = () => {
  return (
    <Box minH="100vh" bg="gray.50" py={8}>
      <VStack spacing={6} align="stretch">
        <Box px={{ base: 4, md: 8 }}>
          <Heading size="xl" mb={2}>Project Analysis (PA)</Heading>
          <Box h="2px" bg="green.500" w="100px" />
        </Box>
        
        <ProjectAnalysisForm />
      </VStack>
    </Box>
  );
};

export default PA;
