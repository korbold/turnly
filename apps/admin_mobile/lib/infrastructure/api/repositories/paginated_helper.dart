import '../../../shared/types/paginated_result.dart';

PaginatedResult<T> extractPaginated<T>(
  Map<String, dynamic> response,
  T Function(Map<String, dynamic>) mapper,
) {
  final items = (response['data'] as List)
      .map((e) => mapper(e as Map<String, dynamic>))
      .toList();

  final meta = response['meta'] as Map<String, dynamic>?;

  if (meta != null) {
    return PaginatedResult<T>(
      data: items,
      currentPage: meta['current_page'] as int? ?? 1,
      lastPage: meta['last_page'] as int? ?? 1,
      perPage: meta['per_page'] as int? ?? items.length,
      total: meta['total'] as int? ?? items.length,
    );
  }

  // Fallback: Laravel may put pagination at root level
  return PaginatedResult<T>(
    data: items,
    currentPage: response['current_page'] as int? ?? 1,
    lastPage: response['last_page'] as int? ?? 1,
    perPage: response['per_page'] as int? ?? items.length,
    total: response['total'] as int? ?? items.length,
  );
}
