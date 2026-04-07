import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import LoadingScreen from './LoadingScreen';

interface Props {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isInitializing = useAuthStore((s) => s.isInitializing);

  if (isInitializing) return <LoadingScreen />;
  if (!accessToken) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
