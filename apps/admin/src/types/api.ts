export interface ApiResponse<T> {
  data: T;
  meta: {
    tenant?: string | null;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    tenant?: string | null;
    timestamp: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}
