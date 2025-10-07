import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  useToast,
  Text,
  Container,
  Spinner,
  Center,
  Flex,
  InputGroup,
  InputLeftElement,
  useColorModeValue,
  Heading,
  Stack,
  HStack,
  Icon,
  Image,
} from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmailIcon, LockIcon, ViewIcon, ViewOffIcon, ArrowBackIcon } from '@chakra-ui/icons';
// No react-icons imports needed
import { supabase } from '../lib/supabase';

interface RedirectLocation {
  pathname: string;
  search?: string;
  hash?: string;
}

interface LoginLocationState {
  from?: RedirectLocation;
  fromHR?: boolean;
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as LoginLocationState | null) ?? null;
  const toast = useToast();
  const { login, isAuthenticated, isLoading } = useAuth();
  const hrEmail = process.env.REACT_APP_HR_EMAIL || '';
  const hrPassword = process.env.REACT_APP_HR_PASSWORD || '';
  const fromHR = Boolean(locationState?.fromHR);
  const pendingRedirect = locationState?.from;
  const isHrQuickLoginConfigured = Boolean(hrEmail && hrPassword);
  const handleForgot = async () => {
    if (!email) {
      toast({ title: 'Enter your email first', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      toast({ title: 'Reset email sent', description: 'Check your inbox for a password reset link', status: 'success', duration: 5000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to send reset email', description: e?.message || String(e), status: 'error', duration: 5000, isClosable: true });
    }
  };

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    if (!isAuthenticated) return;
    navigate(fromHR ? '/hr' : '/welcome', { replace: true });
  }, [fromHR, isAuthenticated, navigate]);

  useEffect(() => {
    if (fromHR && hrEmail) {
      setEmail(hrEmail);
    }
  }, [fromHR, hrEmail]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      await login(email, password);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickHrLogin = async () => {
    if (!isHrQuickLoginConfigured || loading) {
      if (!isHrQuickLoginConfigured) {
        toast({
          title: 'Quick HR login unavailable',
          description: 'Please enter your HR credentials manually.',
          status: 'warning',
          duration: 4000,
          isClosable: true,
        });
      }
      return;
    }

    setLoading(true);

    try {
      await login(hrEmail, hrPassword);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Center h="100vh" bg={bgColor}>
        <VStack spacing={4}>
          <Image
            src="https://cdn.builder.io/api/v1/image/assets%2F2f195b82614d46a0b777d649ad418b24%2F5065c74f0a374ff4a36efc224f468f09?format=webp&width=800"
            alt="Axiso Green Energy Logo"
            h="80px"
            w="auto"
            objectFit="contain"
          />
          <Spinner size="xl" color="green.500" thickness="4px" />
          <Text fontSize="lg" color="gray.600">Loading...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <Container maxW="lg" py={{ base: '12', md: '24' }} px={{ base: '0', sm: '8' }}>
        <Stack spacing="8">
          <Stack spacing="6">
            <Stack spacing={{ base: '2', md: '3' }} textAlign="center">
              <Flex justify="center" align="center" mb={4}>
                <Image
                  src="https://cdn.builder.io/api/v1/image/assets%2F2f195b82614d46a0b777d649ad418b24%2F5065c74f0a374ff4a36efc224f468f09?format=webp&width=800"
                  alt="Axiso Green Energy Logo"
                  h="60px"
                  w="auto"
                  objectFit="contain"
                />
              </Flex>
              <Heading size={{ base: 'xs', md: 'sm' }} color="green.600">
                Axiso Green Energy
              </Heading>
              <Text color="gray.600">
                Sustainable Energy Management Platform
              </Text>
            </Stack>
          </Stack>
          <HStack justify="flex-start">
            <Button leftIcon={<ArrowBackIcon />} variant="outline" colorScheme="green" size="sm" onClick={() => {
              if (isAuthenticated) {
                navigate('/welcome');
              } else {
                navigate(-1);
              }
            }}>
              Back
            </Button>
          </HStack>
          <Box
            py={{ base: '8', sm: '12' }}
            px={{ base: '4', sm: '10' }}
            bg={cardBg}
            boxShadow={{ base: 'none', sm: 'xl' }}
            borderRadius={{ base: 'none', sm: 'xl' }}
            border="1px solid"
            borderColor={borderColor}
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              h="4px"
              bgGradient="linear(to-r, green.400, blue.400, purple.400)"
            />
            <form onSubmit={handleLogin}>
              <Stack spacing="6">
                <Stack spacing="5">
                <FormControl isRequired>
                  <FormLabel htmlFor="email" color="gray.600">Email</FormLabel>
                  <InputGroup>
                    <InputLeftElement>
                      <EmailIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      placeholder="Enter your email"
                      _placeholder={{ color: 'gray.400' }}
                      borderColor="gray.300"
                      _hover={{ borderColor: 'green.400' }}
                      _focus={{ borderColor: 'green.500', boxShadow: '0 0 0 1px #48BB78' }}
                    />
                  </InputGroup>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel htmlFor="password" color="gray.600">Password</FormLabel>
                  <InputGroup>
                    <InputLeftElement>
                      <LockIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      placeholder="Enter your password"
                      _placeholder={{ color: 'gray.400' }}
                      borderColor="gray.300"
                      _hover={{ borderColor: 'green.400' }}
                      _focus={{ borderColor: 'green.500', boxShadow: '0 0 0 1px #48BB78' }}
                    />
                    <Button
                      variant="ghost"
                      onClick={() => setShowPassword(!showPassword)}
                      position="absolute"
                      right="0"
                      top="0"
                      h="full"
                      px={3}
                      _hover={{ bg: 'transparent' }}
                    >
                      <Icon as={showPassword ? ViewOffIcon : ViewIcon} color="gray.400" />
                    </Button>
                  </InputGroup>
                </FormControl>
                <HStack justify="flex-end">
                  <Button variant="link" size="sm" colorScheme="green" onClick={handleForgot}>Forgot password?</Button>
                </HStack>
                </Stack>
                <Stack spacing="6">
                  <Button
                    type="submit"
                  bgGradient="linear(to-r, green.400, green.500)"
                  _hover={{
                    bgGradient: 'linear(to-r, green.500, green.600)',
                    transform: 'translateY(-1px)',
                    boxShadow: 'lg',
                  }}
                  _active={{
                    transform: 'translateY(0)',
                  }}
                  color="white"
                  size="lg"
                  fontSize="md"
                  isLoading={loading}
                  loadingText="Signing in..."
                  transition="all 0.2s"
                >
                  Sign In
                </Button>
                {fromHR && isHrQuickLoginConfigured && (
                  <Button
                    variant="outline"
                    colorScheme="green"
                    size="sm"
                    onClick={handleQuickHrLogin}
                    isDisabled={loading}
                  >
                    Quick HR Login
                  </Button>
                )}
                {fromHR && !isHrQuickLoginConfigured && (
                  <Text fontSize="sm" color="orange.500" textAlign="center">
                    Quick HR login is not configured. Please sign in with your HR email and password.
                  </Text>
                )}
                <HStack justify="center">
                  <Text fontSize="sm" color="gray.600">
                    Powered by renewable energy solutions
                  </Text>
                </HStack>
                </Stack>
              </Stack>
            </form>
          </Box>
        </Stack>
        <Box mt={8} textAlign="center" px={{ base: 4, md: 0 }}>
          <Heading size="sm" color="green.600" mb={2}>Our Mission</Heading>
          <Text color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>
            To accelerate clean energy adoption by delivering reliable solar solutions, transparent processes, and exceptional service.
          </Text>
          <Heading size="sm" color="green.600" mt={6} mb={2}>Our Vision</Heading>
          <Text color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>
            A sustainable future powered by affordable, clean energy for every business and home we serve.
          </Text>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;
