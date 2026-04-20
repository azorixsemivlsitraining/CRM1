import React from 'react';
import ErrorDisplay from '../components/ErrorDisplay';

const ErrorTest: React.FC = () => {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <ErrorDisplay
      title="Connection Error"
      message="Server not ready after waiting"
      errorCode="timeout"
      onRetry={handleRetry}
      retryLabel="Retry"
      showIcon={true}
    />
  );
};

export default ErrorTest;
