import { Outlet } from 'react-router-dom';
import { getAuthSession } from '../utils/token';
import { AccessDenied } from '../../../components/common/AccessDenied';

interface RoleGuardProps {
  requiredRole?: 'ORG_ADMIN';
  allowedRoles?: string[];
  fallbackUrl?: string;
}

export function RoleGuard({
  requiredRole = 'ORG_ADMIN',
  allowedRoles,
  fallbackUrl = '/pos',
}: RoleGuardProps) {
  const session = getAuthSession();

  let isAuthorized = false;
  if (requiredRole === 'ORG_ADMIN') {
    isAuthorized = session.isOrgAdmin;
  } else if (allowedRoles && allowedRoles.length > 0) {
    const userRole = session.user?.role;
    const storeRole = session.currentStore?.role;
    isAuthorized =
      session.isOrgAdmin ||
      (userRole && allowedRoles.includes(userRole)) ||
      (storeRole && allowedRoles.includes(storeRole));
  }

  if (!isAuthorized) {
    return (
      <AccessDenied
        requiredRole={
          requiredRole === 'ORG_ADMIN'
            ? 'Organization Administrator'
            : (allowedRoles?.join(', ') || 'Authorized Staff')
        }
        fallbackUrl={fallbackUrl}
      />
    );
  }

  return <Outlet />;
}
