import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';

export interface Organization {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
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
