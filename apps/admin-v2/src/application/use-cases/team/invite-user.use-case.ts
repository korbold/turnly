import type { CreateMemberInput, UserRepository } from '@/domain/repositories/user.repository';

export class InviteUserUseCase {
  constructor(private repo: UserRepository) {}

  execute(input: CreateMemberInput) {
    return this.repo.invite(input);
  }
}
