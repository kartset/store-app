import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import type {
  DryRunResponse,
  ExportEntity,
  ExportFilterParams,
  ImportCommitResponse,
  TemplateType,
} from '../types';

export function useImportProductsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      file?: File;
      csv_content?: string;
      dry_run: boolean;
      store_id?: string;
      update_existing?: boolean;
    }) => {
      const queryParams: Record<string, string> = {
        dry_run: payload.dry_run ? 'true' : 'false',
      };
      if (payload.store_id) queryParams.store_id = payload.store_id;

      if (payload.file) {
        const formData = new FormData();
        formData.append('file', payload.file);
        if (payload.update_existing !== undefined) {
          formData.append('update_existing', String(payload.update_existing));
        }
        const response = await api.post<DryRunResponse | ImportCommitResponse>(
          '/api/data-exchange/products/import/',
          formData,
          {
            params: queryParams,
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );
        return response.data;
      } else {
        const response = await api.post<DryRunResponse | ImportCommitResponse>(
          '/api/data-exchange/products/import/',
          {
            csv_content: payload.csv_content,
            update_existing: payload.update_existing ?? true,
          },
          { params: queryParams }
        );
        return response.data;
      }
    },
    onSuccess: (data) => {
      if (!data.dry_run) {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-inventory-health'] });
      }
    },
  });
}

export function useImportCustomersMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      file?: File;
      csv_content?: string;
      dry_run: boolean;
      store_id?: string;
    }) => {
      const queryParams: Record<string, string> = {
        dry_run: payload.dry_run ? 'true' : 'false',
      };
      if (payload.store_id) queryParams.store_id = payload.store_id;

      if (payload.file) {
        const formData = new FormData();
        formData.append('file', payload.file);
        const response = await api.post<DryRunResponse | ImportCommitResponse>(
          '/api/data-exchange/customers/import/',
          formData,
          {
            params: queryParams,
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );
        return response.data;
      } else {
        const response = await api.post<DryRunResponse | ImportCommitResponse>(
          '/api/data-exchange/customers/import/',
          { csv_content: payload.csv_content },
          { params: queryParams }
        );
        return response.data;
      }
    },
    onSuccess: (data) => {
      if (!data.dry_run) {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }
    },
  });
}

export async function downloadSampleTemplate(type: TemplateType) {
  const response = await api.get(`/api/data-exchange/templates/${type}/`, {
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${type}_import_template.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadUniversalExport(entity: ExportEntity, params?: ExportFilterParams) {
  const queryParams: Record<string, string> = {};
  if (params?.store_id) queryParams.store_id = params.store_id;
  if (params?.start_date) queryParams.start_date = params.start_date;
  if (params?.end_date) queryParams.end_date = params.end_date;

  const response = await api.get(`/api/data-exchange/export/${entity}/`, {
    params: queryParams,
    responseType: 'blob',
  });

  const filename = `${entity}_export_${new Date().toISOString().slice(0, 10)}.csv`;
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
