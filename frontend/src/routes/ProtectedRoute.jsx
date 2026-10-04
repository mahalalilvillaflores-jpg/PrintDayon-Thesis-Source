import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoadingScreen = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F8FAFC' }}>
    <div className="spinner" style={{ width: '2.5rem', height: '2.5rem' }} />
  </div>
);

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
};

export const RoleRoute = ({ children, roles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!roles.includes(user?.role)) return <Navigate to="/unauthorized" replace />;

  return children;
};

export const GuestRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (isAuthenticated) {
    const redirectMap = {
      customer: '/dashboard',
      shop_owner: '/owner/dashboard',
      admin: '/admin/dashboard',
    };
    return <Navigate to={redirectMap[user.role] || '/dashboard'} replace />;
  }

  return children;
};
