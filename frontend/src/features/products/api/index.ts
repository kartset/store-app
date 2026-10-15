import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  Brand,
  Category,
  OrganizationCategory,
  CreateProductPayload,
  CreateSubcategoryPayload,
  Product,
  Subcategory,
} from '../types';

export interface ProductFilterParams {
  organization_id?: string;
  category_id?: string;
  subcategory_id?: string;
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
      if (params?.subcategory_id) queryParams.subcategory_id = params.subcategory_id;
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

export function useCategories(parent?: string | null, organizationId?: string) {
  return useQuery({
    queryKey: ['categories', parent, organizationId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (parent !== undefined) params.parent = parent ?? 'null';
      if (organizationId) params.organization_id = organizationId;

      const response = await api.get<Category[]>('/api/products/categories/', {
        params: Object.keys(params).length ? params : undefined,
      });
      return response.data;
    },
  });
}

export function useOrganizationCategories(organizationId?: string) {
  return useQuery({
    queryKey: ['organization-categories', organizationId],
    queryFn: async () => {
      const response = await api.get<OrganizationCategory[]>('/api/products/organization-categories/', {
        params: organizationId ? { organization_id: organizationId } : undefined,
      });
      return response.data;
    },
    enabled: Boolean(organizationId),
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

export interface SubcategoryFilterParams {
  organization_id?: string;
  category_id?: string;
  is_active?: boolean;
  search?: string;
}

export function useSubcategories(params?: SubcategoryFilterParams) {
  return useQuery({
    queryKey: ['subcategories', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.organization_id) queryParams.organization_id = params.organization_id;
      if (params?.category_id) queryParams.category_id = params.category_id;
      if (params?.is_active !== undefined) queryParams.is_active = String(params.is_active);
      if (params?.search) queryParams.search = params.search;

      const response = await api.get<Subcategory[]>('/api/products/subcategories/', {
        params: queryParams,
      });
      return response.data;
    },
    enabled: params ? !!(params.organization_id || params.category_id) : true,
  });
}

export function useCreateSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSubcategoryPayload) => {
      const response = await api.post<Subcategory>('/api/products/subcategories/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    },
  });
}

export function useUpdateSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateSubcategoryPayload> }) => {
      const response = await api.patch<Subcategory>(`/api/products/subcategories/${id}/`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/products/subcategories/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
