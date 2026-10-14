import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';

export interface Organization {
  id: string;
  name: string;
  subdomain?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await api.get<Organization[]>('/api/organizations/');
      return response.data;
    },
  });
}
