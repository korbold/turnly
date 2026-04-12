class Service {
  final String id;
  final String name;
  final String? description;
  final double price;
  final int durationMinutes;
  final bool isActive;
  final int sortOrder;

  const Service({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    required this.durationMinutes,
    required this.isActive,
    required this.sortOrder,
  });
}
