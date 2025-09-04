import React from 'react';
import { Navigate, Link as RouterLink } from 'react-router-dom';
import { Center, Spinner, Box, Text, Button } from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';

const ModuleGuard: React.FC<{ moduleKey: string; children: React.ReactNode }> = ({ moduleKey, children }) => {
  const { isLoading, isAuthenticated, isAdmin, allowedModules } = useAuth();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" color="blue.500" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isAdmin) return <>{children}</>;

  const allowed = Array.isArray(allowedModules) && allowedModules.includes(moduleKey);
  if (!allowed) {
    return (
      <Center h="100vh">
        <Box textAlign="center">
          <Text fontSize="xl" color="red.500" mb={2}>No access</Text>
          <Text color="gray.600" mb={4}>You don't have permission to view this module.</Text>
          <Button as={RouterLink} to="/welcome" colorScheme="green">Back</Button>
        </Box>
      </Center>
    );
  }

  return <>{children}</>;
};

export default ModuleGuard;
