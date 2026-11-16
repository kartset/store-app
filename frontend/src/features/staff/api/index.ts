import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type { PaginatedResponse } from '../../../types/pagination';
import type {
  CheckEmailResponse,
  StaffListParams,
  StaffMember,
  StaffOnboardPayload,
  StaffUpdatePayload,
} from '../types';

export function useStaffList(params?: StaffListParams) {
  return useQuery({
    queryKey: ['staff', 'list', params],
    queryFn: async () => {
      const queryParams: Record<string, any> = {
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 10,
      };
      if (params?.store_id) queryParams.store_id = params.store_id;
      if (params?.role) queryParams.role = params.role;
      if (params?.is_active !== undefined) queryParams.is_active = params.is_active;
      if (params?.search) queryParams.search = params.search;

      const response = await api.get<PaginatedResponse<StaffMember>>('/api/staff/', {
        params: queryParams,
      });
      return response.data;
    },
  });
}

export async function checkStaffEmail(email: string): Promise<CheckEmailResponse> {
  const response = await api.get<CheckEmailResponse>('/api/staff/check-email/', {
    params: { email },
  });
  return response.data;
}

export function useOnboardStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StaffOnboardPayload) => {
      const response = await api.post<StaffMember>('/api/staff/onboard/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: StaffUpdatePayload;
    }) => {
      const response = await api.patch<StaffMember>(`/api/staff/${id}/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/staff/${id}/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { old_password: string; new_password: string }) => {
      const response = await api.post('/api/users/auth/change-password/', payload);
      return response.data;
    },
  });
}
