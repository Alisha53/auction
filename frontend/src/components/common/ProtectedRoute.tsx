import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ProtectedRouteProps } from '../../types';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, role }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p className="text-secondary-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user?.role !== role) {
    // Redirect to appropriate dashboard based on user role
    const dashboardPath = `/${user?.role}/dashboard`;
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;