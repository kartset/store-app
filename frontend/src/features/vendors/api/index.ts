import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type { CreateVendorInput, UpdateVendorInput, Vendor, VendorFilterParams } from '../types';

export function useVendors(params?: VendorFilterParams) {
  return useQuery({
    queryKey: ['vendors', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.organization_id) queryParams.organization_id = params.organization_id;
      if (params?.is_active !== undefined) queryParams.is_active = String(params.is_active);
      if (params?.payment_terms) queryParams.payment_terms = params.payment_terms;
      if (params?.state_code) queryParams.state_code = params.state_code;
      if (params?.search) queryParams.search = params.search;

      const response = await api.get<Vendor[] | { results: Vendor[] }>('/api/vendors/', {
        params: queryParams,
      });

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return response.data.results || [];
    },
  });
}

export function useVendor(id?: string) {
  return useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<Vendor>(`/api/vendors/${id}/`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateVendorInput) => {
      const response = await api.post<Vendor>('/api/vendors/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateVendorInput }) => {
      const response = await api.patch<Vendor>(`/api/vendors/${id}/`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor', variables.id] });
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/vendors/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}
