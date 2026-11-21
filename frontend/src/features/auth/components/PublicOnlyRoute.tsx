import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { getAuthSession } from '../utils/token';

export function PublicOnlyRoute() {
  const session = getAuthSession();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/pos';

  if (session.isAuthenticated) {
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
}
