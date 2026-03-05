import React, { useEffect, useState } from 'react';
import { Box, Button, Heading, Input, FormControl, FormLabel, VStack, useToast, Text } from '@chakra-ui/react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // If we have a session (from recovery link), allow reset; otherwise prompt
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setReady(!!session);
    };
    check();
  }, []);

  const handleReset = async () => {
    try {
      if (!password || password.length < 6) {
        toast({ title: 'Password too short', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      if (password !== confirm) {
        toast({ title: 'Passwords do not match', status: 'error', duration: 3000, isClosable: true });
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated', status: 'success', duration: 3000, isClosable: true });
      navigate('/login');
    } catch (e: any) {
      toast({ title: 'Failed to update password', description: e?.message || String(e), status: 'error', duration: 5000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="md" mx="auto" mt={12} p={6} borderWidth="1px" borderRadius="lg" bg="white">
      <Heading size="md" mb={4}>Reset Password</Heading>
      {!ready ? (
        <Text color="gray.600">Open the reset link from your email to continue.</Text>
      ) : (
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel>New Password</FormLabel>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Confirm Password</FormLabel>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </FormControl>
          <Button colorScheme="green" onClick={handleReset} isLoading={loading}>Update Password</Button>
        </VStack>
      )}
    </Box>
  );
};

export default ResetPassword;
