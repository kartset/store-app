import { useQuery } from '@tanstack/react-query';

export interface Organization {
  id: string;
  name: string;
  subdomain?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useOrganizations() {
  return useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: () => {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const user = JSON.parse(stored);
          if (Array.isArray(user.organizations)) {
            return user.organizations.map((org: { id: string; name: string }) => ({
              id: org.id,
              name: org.name,
              is_active: true,
            }));
          }
        }
      } catch {
        // fallback to empty list
      }
      return [];
    },
  });
}
