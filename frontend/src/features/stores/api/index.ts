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

export function useStores(params?: { organization_id?: string }) {
  return useQuery({
    queryKey: ['stores', params?.organization_id],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        fields: 'id,name,gst_number,address,is_active,organization_id,organization.name,organization.subdomain',
      });
      if (params?.organization_id) {
        searchParams.append('organization_id', params.organization_id);
      }
      const response = await api.get<Store[]>(`/api/stores/?${searchParams.toString()}`);
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
