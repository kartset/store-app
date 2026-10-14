import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  Brand,
  Category,
  CreateProductPayload,
  Product,
} from '../types';

export interface ProductFilterParams {
  organization_id?: string;
  category_id?: string;
  brand_id?: string;
  is_active?: boolean;
  search?: string;
}

export function useProducts(params?: ProductFilterParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.organization_id) queryParams.organization_id = params.organization_id;
      if (params?.category_id) queryParams.category_id = params.category_id;
      if (params?.brand_id) queryParams.brand_id = params.brand_id;
      if (params?.is_active !== undefined) queryParams.is_active = String(params.is_active);
      if (params?.search) queryParams.search = params.search;

      const response = await api.get<Product[]>('/api/products/', {
        params: queryParams,
      });
      return response.data;
    },
  });
}

export function useCategories(parent?: string | null) {
  return useQuery({
    queryKey: ['categories', parent],
    queryFn: async () => {
      const response = await api.get<Category[]>('/api/products/categories/', {
        params: parent !== undefined ? { parent: parent ?? 'null' } : undefined,
      });
      return response.data;
    },
  });
}

export function useCategoryTree() {
  return useQuery({
    queryKey: ['category-tree'],
    queryFn: async () => {
      const response = await api.get<Category[]>('/api/products/categories/tree/');
      return response.data;
    },
  });
}

export function useBrands(organizationId?: string) {
  return useQuery({
    queryKey: ['brands', organizationId],
    queryFn: async () => {
      const response = await api.get<Brand[]>('/api/products/brands/', {
        params: organizationId ? { organization_id: organizationId } : undefined,
      });
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateProductPayload) => {
      const response = await api.post<Product>('/api/products/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateProductPayload> }) => {
      const response = await api.patch<Product>(`/api/products/${id}/`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/products/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export async function lookupBarcode(code: string, organizationId?: string) {
  const response = await api.get<Product>(`/api/products/barcode/${encodeURIComponent(code)}/`, {
    params: organizationId ? { organization_id: organizationId } : undefined,
  });
  return response.data;
}
