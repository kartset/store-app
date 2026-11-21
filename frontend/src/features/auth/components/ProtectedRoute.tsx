import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAuthSession, clearAuthSession } from '../utils/token';

export function ProtectedRoute() {
  const location = useLocation();
  const session = getAuthSession();

  if (!session.isAuthenticated) {
    // Purge any stale tokens
    clearAuthSession();
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  return <Outlet />;
}
