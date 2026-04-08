import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RegionGuardProps {
  allowed: string[];
  children: React.ReactNode;
}

const RegionGuard: React.FC<RegionGuardProps> = ({ allowed, children }) => {
  const { assignedRegions, isAdmin } = useAuth();
  const noAssignments = (assignedRegions?.length || 0) === 0;
  if (isAdmin || noAssignments) return <>{children}</>;
  const hasAccess = allowed.some((r) => assignedRegions.includes(r));
  if (!hasAccess) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default RegionGuard;
