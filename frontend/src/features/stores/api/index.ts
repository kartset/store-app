import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';

export interface Store {
  id: string;
  name: string;
  gst_number?: string | null;
  address?: string | null;
  is_active: boolean;
  organization_id?: string;
  organization?: {
    id: string;
    name: string;
    subdomain?: string | null;
  };
}

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get<Store[]>(
        '/api/stores/?fields=id,name,gst_number,address,is_active,organization_id,organization.name,organization.subdomain'
      );
      return response.data;
    },
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; gst_number?: string; address?: string }) => {
      const response = await api.post<Store>('/api/stores/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}
