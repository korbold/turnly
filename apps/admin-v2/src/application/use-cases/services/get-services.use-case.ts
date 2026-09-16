import type {
  ServiceRepository,
  ListServicesParams,
} from '@/domain/repositories/service.repository';

export class GetServicesUseCase {
  constructor(private repo: ServiceRepository) {}

  execute(params?: ListServicesParams) {
    return this.repo.getAll(params);
  }
}
