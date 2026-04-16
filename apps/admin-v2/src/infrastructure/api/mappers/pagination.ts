import type { PaginatedResult } from '@/shared/types/api';

interface LaravelPaginatedResponse {
  data: unknown[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export function mapPaginatedResponse<TRaw, TDomain>(
  response: LaravelPaginatedResponse,
  mapItem: (raw: TRaw) => TDomain,
): PaginatedResult<TDomain> {
  const meta = response.meta ?? {
    current_page: response.current_page ?? 1,
    last_page: response.last_page ?? 1,
    per_page: response.per_page ?? 15,
    total: response.total ?? response.data.length,
  };

  return {
    data: (response.data as TRaw[]).map(mapItem),
    meta: {
      currentPage: meta.current_page,
      lastPage: meta.last_page,
      perPage: meta.per_page,
      total: meta.total,
    },
  };
}
