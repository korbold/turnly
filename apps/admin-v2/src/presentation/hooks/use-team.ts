'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetTeamUseCase } from '@/application/use-cases/team/get-team.use-case';
import { InviteUserUseCase } from '@/application/use-cases/team/invite-user.use-case';
import { ChangeRoleUseCase } from '@/application/use-cases/team/change-role.use-case';
import { ResetPasswordUseCase } from '@/application/use-cases/team/reset-password.use-case';
import type { UserRole } from '@/domain/entities/user';
import type { CreateMemberInput } from '@/domain/repositories/user.repository';

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
    mutationFn: (input: CreateMemberInput) => new InviteUserUseCase(repo).execute(input),
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

export function useResetPassword() {
  const repo = useRepository('user');
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      new ResetPasswordUseCase(repo).execute(id, password),
  });
}
