'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/infrastructure/api/client';

export interface BusinessCategory {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  color: string | null;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data: res } = await api.get('/superadmin/categories');
      return res.data as BusinessCategory[];
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; emoji?: string; color?: string; description?: string; icon?: string }) => {
      const { data: res } = await api.post('/superadmin/categories', data);
      return res.data as BusinessCategory;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; emoji?: string; color?: string; description?: string; icon?: string; is_active?: boolean }) => {
      const { data: res } = await api.patch(`/superadmin/categories/${id}`, data);
      return res.data as BusinessCategory;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/superadmin/categories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
