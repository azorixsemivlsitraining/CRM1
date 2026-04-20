import React from 'react';
import {
  Center,
  Circle,
  Heading,
  Text,
  Button,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  errorCode?: string;
  onRetry?: () => void;
  retryLabel?: string;
  showIcon?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title = 'Connection Error',
  message = 'Server not ready after waiting',
  errorCode = 'timeout',
  onRetry,
  retryLabel = 'Retry',
  showIcon = true,
}) => {
  const bgColor = useColorModeValue('gray.900', 'gray.950');
  const textColor = useColorModeValue('white', 'gray.100');
  const subtitleColor = useColorModeValue('gray.300', 'gray.400');

  return (
    <Center minH="100vh" bg={bgColor}>
      <VStack spacing={6} textAlign="center" px={4}>
        {showIcon && (
          <Circle size="80px" bg="red.500" display="flex" alignItems="center" justifyContent="center">
            <Text fontSize="40px" color="white" fontWeight="bold">
              !
            </Text>
          </Circle>
        )}

        <VStack spacing={2} maxW="400px">
          <Heading size="lg" color={textColor}>
            {title}
          </Heading>
          <Text fontSize="md" color={subtitleColor}>
            {message}
          </Text>
          {errorCode && (
            <Text fontSize="sm" color="red.400" fontWeight="medium">
              Error Code: {errorCode}
            </Text>
          )}
        </VStack>

        {onRetry && (
          <Button
            colorScheme="red"
            size="lg"
            px={8}
            onClick={onRetry}
          >
            {retryLabel}
          </Button>
        )}
      </VStack>
    </Center>
  );
};

export default ErrorDisplay;
