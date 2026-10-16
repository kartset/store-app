import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  CreateCustomerInput,
  Customer,
  CustomerFilterParams,
  CustomerInvoice,
  CustomerLookupResponse,
  UpdateCustomerInput,
} from '../types';

export function useCustomers(params?: CustomerFilterParams) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.customer_type) queryParams.customer_type = params.customer_type;
      if (params?.is_active !== undefined) queryParams.is_active = String(params.is_active);
      if (params?.search) queryParams.search = params.search;

      const response = await api.get<Customer[] | { results: Customer[] }>('/api/customers/', {
        params: queryParams,
      });

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return response.data.results || [];
    },
  });
}

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<Customer>(`/api/customers/${id}/`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCustomerInput) => {
      const response = await api.post<Customer>('/api/customers/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCustomerInput }) => {
      const response = await api.patch<Customer>(`/api/customers/${id}/`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/customers/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useCustomerLookup(mobile?: string, storeId?: string) {
  return useQuery({
    queryKey: ['customer-lookup', mobile, storeId],
    queryFn: async () => {
      if (!mobile) return null;
      const params: Record<string, string> = { mobile };
      if (storeId) params.store_id = storeId;
      const response = await api.get<CustomerLookupResponse>('/api/customers/lookup/', { params });
      return response.data;
    },
    enabled: Boolean(mobile && mobile.length >= 10),
  });
}

export function useCustomerInvoices(customerId?: string, storeId?: string) {
  return useQuery({
    queryKey: ['customer-invoices', customerId, storeId],
    queryFn: async () => {
      if (!customerId) return [];
      const params: Record<string, string> = {};
      if (storeId) params.store_id = storeId;
      const response = await api.get<CustomerInvoice[]>(`/api/customers/${customerId}/invoices/`, { params });
      return response.data || [];
    },
    enabled: Boolean(customerId),
  });
}
