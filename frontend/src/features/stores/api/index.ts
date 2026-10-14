import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';

export interface Store {
  id: string;
  name: string;
  location: string;
  contact_email: string;
  contact_phone: string;
  organization_name?: string; // Fetched dynamically via dotted fields
}

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      // Showcasing the dynamic serializer capability we just built!
      const response = await api.get<Store[]>('/api/stores/?fields=id,name,location,contact_email,contact_phone,organization.name');
      return response.data;
    },
  });
}
