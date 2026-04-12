class Vehicle {
  final String id;
  final String plate;
  final String? brand;
  final String? model;
  final String? color;
  final String type;
  final String? ownerName;

  const Vehicle({
    required this.id,
    required this.plate,
    this.brand,
    this.model,
    this.color,
    this.type = 'sedan',
    this.ownerName,
  });
}
