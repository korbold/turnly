class PaginatedResult<T> {
  final List<T> data;
  final int currentPage;
  final int lastPage;
  final int perPage;
  final int total;

  const PaginatedResult({
    required this.data,
    required this.currentPage,
    required this.lastPage,
    required this.perPage,
    required this.total,
  });
}
