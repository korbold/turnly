// lib/app/theme/app_colors.dart
import 'package:flutter/material.dart';

class AppColors {
  // Base neutral palette
  static const background = Color(0xFFF8F9FB);
  static const surface = Color(0xFFFFFFFF);
  static const textPrimary = Color(0xFF1A1D26);
  static const textSecondary = Color(0xFF6B7280);
  static const textTertiary = Color(0xFF9CA3AF);
  static const border = Color(0xFFE5E7EB);
  static const divider = Color(0xFFF3F4F6);

  // Status colors
  static const success = Color(0xFF10B981);
  static const warning = Color(0xFFF59E0B);
  static const error = Color(0xFFEF4444);
  static const info = Color(0xFF3B82F6);

  // Default accent (used when no tenant theme)
  static const accent = Color(0xFF6366F1);
  static const accentLight = Color(0xFFEEF2FF);
}
