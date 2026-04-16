'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetTeamUseCase } from '@/application/use-cases/team/get-team.use-case';
import { InviteUserUseCase } from '@/application/use-cases/team/invite-user.use-case';
import { ChangeRoleUseCase } from '@/application/use-cases/team/change-role.use-case';
import type { UserRole } from '@/domain/entities/user';

export function useTeam(filters?: { role?: UserRole; excludeRole?: UserRole }) {
  const repo = useRepository('user');
  return useQuery({
    queryKey: ['team', filters],
    queryFn: () => new GetTeamUseCase(repo).execute(filters),
  });
}

export function useInviteUser() {
  const repo = useRepository('user');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: UserRole }) =>
      new InviteUserUseCase(repo).execute(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
}

export function useChangeRole() {
  const repo = useRepository('user');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      new ChangeRoleUseCase(repo).execute(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
}
