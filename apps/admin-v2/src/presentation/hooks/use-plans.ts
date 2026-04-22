'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/infrastructure/api/client';
import { mapPlan } from '@/infrastructure/api/mappers/plan.mapper';
import type { Plan } from '@/domain/entities/plan';

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data: res } = await api.get('/superadmin/plans');
      return (res.data as Record<string, unknown>[]).map(mapPlan);
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      price: number;
      max_services?: number | null;
      max_reservations_per_month?: number | null;
      max_employees?: number | null;
      has_push_notifications?: boolean;
      has_reports?: boolean;
      has_reminders?: boolean;
      has_custom_page?: boolean;
      description?: string;
    }) => {
      const { data: res } = await api.post('/superadmin/plans', data);
      return mapPlan(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<{
      name: string;
      price: number;
      max_services: number | null;
      max_reservations_per_month: number | null;
      max_employees: number | null;
      has_push_notifications: boolean;
      has_reports: boolean;
      has_reminders: boolean;
      has_custom_page: boolean;
      is_active: boolean;
      sort_order: number;
      description: string | null;
    }>) => {
      const { data: res } = await api.patch(`/superadmin/plans/${id}`, data);
      return mapPlan(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/superadmin/plans/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useAssignPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, planId }: { tenantId: string; planId: string }) => {
      await api.post(`/superadmin/tenants/${tenantId}/assign-plan`, { plan_id: planId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'tenants'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
