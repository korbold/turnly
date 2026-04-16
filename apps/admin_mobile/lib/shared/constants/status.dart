import 'package:flutter/material.dart';
import 'colors.dart';

class StatusConfig {
  final String label;
  final Color color;
  final Color bgColor;

  const StatusConfig({
    required this.label,
    required this.color,
    required this.bgColor,
  });
}

const Map<String, StatusConfig> reservationStatusConfig = {
  'pending': StatusConfig(
    label: 'Pendiente',
    color: AppColors.statusPending,
    bgColor: AppColors.statusPendingBg,
  ),
  'confirmed': StatusConfig(
    label: 'Confirmada',
    color: AppColors.statusConfirmed,
    bgColor: AppColors.statusConfirmedBg,
  ),
  'in_progress': StatusConfig(
    label: 'En Progreso',
    color: AppColors.statusInProgress,
    bgColor: AppColors.statusInProgressBg,
  ),
  'completed': StatusConfig(
    label: 'Completada',
    color: AppColors.statusCompleted,
    bgColor: AppColors.statusCompletedBg,
  ),
  'cancelled': StatusConfig(
    label: 'Cancelada',
    color: AppColors.statusCancelled,
    bgColor: AppColors.statusCancelledBg,
  ),
  'no_show': StatusConfig(
    label: 'No Show',
    color: AppColors.statusNoShow,
    bgColor: AppColors.statusNoShowBg,
  ),
};

const Map<String, String> paymentMethodLabels = {
  'cash': 'Efectivo',
  'card': 'Tarjeta',
  'transfer': 'Transferencia',
  'other': 'Otro',
};
