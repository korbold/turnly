import 'package:flutter/material.dart';

class CategoryStyle {
  final Color background;
  final Color iconColor;
  final IconData icon;
  final String label;

  const CategoryStyle({
    required this.background,
    required this.iconColor,
    required this.icon,
    required this.label,
  });
}

class CategoryColors {
  static const _styles = <String, CategoryStyle>{
    'car_wash': CategoryStyle(
      background: Color(0xFFDBEAFE),
      iconColor: Color(0xFF2563EB),
      icon: Icons.local_car_wash,
      label: 'Lavado de autos',
    ),
    'barbershop': CategoryStyle(
      background: Color(0xFFFFEDD5),
      iconColor: Color(0xFFEA580C),
      icon: Icons.content_cut,
      label: 'Barberia',
    ),
    'spa': CategoryStyle(
      background: Color(0xFFD1FAE5),
      iconColor: Color(0xFF059669),
      icon: Icons.spa,
      label: 'Spa',
    ),
    'gym': CategoryStyle(
      background: Color(0xFFFEE2E2),
      iconColor: Color(0xFFDC2626),
      icon: Icons.fitness_center,
      label: 'Gimnasio',
    ),
    'medical': CategoryStyle(
      background: Color(0xFFEDE9FE),
      iconColor: Color(0xFF7C3AED),
      icon: Icons.medical_services,
      label: 'Clinica',
    ),
  };

  static const _default = CategoryStyle(
    background: Color(0xFFE7EDFF),
    iconColor: Color(0xFF396AFF),
    icon: Icons.store,
    label: 'Negocio',
  );

  static CategoryStyle get(String? type) => _styles[type] ?? _default;

  static List<MapEntry<String?, CategoryStyle>> get allWithDefault => [
    const MapEntry(null, CategoryStyle(
      background: Color(0xFFE7EDFF),
      iconColor: Color(0xFF396AFF),
      icon: Icons.apps,
      label: 'Todos',
    )),
    ..._styles.entries,
  ];
}
