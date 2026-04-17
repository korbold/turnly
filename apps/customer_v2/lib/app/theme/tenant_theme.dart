// lib/app/theme/tenant_theme.dart
import 'package:flutter/material.dart';

class TenantTheme {
  final Color primary;
  final Color secondary;
  final Color accent;

  const TenantTheme({
    required this.primary,
    required this.secondary,
    required this.accent,
  });

  /// Default palettes by business type
  static const Map<String, TenantTheme> defaults = {
    'car_wash': TenantTheme(
      primary: Color(0xFF0EA5E9),
      secondary: Color(0xFFE0F2FE),
      accent: Color(0xFF0284C7),
    ),
    'barbershop': TenantTheme(
      primary: Color(0xFF1E293B),
      secondary: Color(0xFFF1F5F9),
      accent: Color(0xFFF59E0B),
    ),
    'spa': TenantTheme(
      primary: Color(0xFFA78BFA),
      secondary: Color(0xFFEDE9FE),
      accent: Color(0xFF7C3AED),
    ),
    'gym': TenantTheme(
      primary: Color(0xFF10B981),
      secondary: Color(0xFFD1FAE5),
      accent: Color(0xFF059669),
    ),
    'medical': TenantTheme(
      primary: Color(0xFF06B6D4),
      secondary: Color(0xFFCFFAFE),
      accent: Color(0xFF0891B2),
    ),
  };

  static const TenantTheme fallback = TenantTheme(
    primary: Color(0xFF6366F1),
    secondary: Color(0xFFEEF2FF),
    accent: Color(0xFF4F46E5),
  );

  /// Resolve theme from business type string
  static TenantTheme fromBusinessType(String? type) {
    if (type == null) return fallback;
    return defaults[type] ?? fallback;
  }
}
