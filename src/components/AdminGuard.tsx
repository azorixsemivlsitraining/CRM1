import React from 'react';
import { Navigate, Link as RouterLink } from 'react-router-dom';
import { Center, Spinner, Box, Text, Button } from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';

const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();

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

  if (!isAdmin) {
    return (
      <Center h="100vh">
        <Box textAlign="center">
          <Text fontSize="xl" color="red.500" mb={2}>No access</Text>
          <Text color="gray.600" mb={4}>You don't have permission to view this page.</Text>
          <Button as={RouterLink} to="/welcome" colorScheme="green">Back</Button>
        </Box>
      </Center>
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
