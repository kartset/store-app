import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type { PaginatedResponse, PaginationParams } from '../../../types/pagination';

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

export interface StoreFilterParams extends PaginationParams {
  search?: string;
  is_active?: boolean;
}

export function usePaginatedStores(params?: StoreFilterParams) {
  return useQuery({
    queryKey: ['stores', 'paginated', params],
    queryFn: async () => {
      const queryParams: Record<string, any> = {
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 5,
        fields: 'id,name,gst_number,address,is_active,organization_id,organization.name,organization.subdomain',
      };
      if (params?.search) queryParams.search = params.search;
      if (params?.is_active !== undefined) queryParams.is_active = params.is_active;

      const response = await api.get<PaginatedResponse<Store>>('/api/stores/', {
        params: queryParams,
      });
      return response.data;
    },
  });
}

export function useStores() {
  return useQuery({
    queryKey: ['stores', 'all'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Store> | Store[]>(
        '/api/stores/?page_size=100&fields=id,name,gst_number,address,is_active,organization_id,organization.name,organization.subdomain'
      );
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return response.data.results || [];
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
