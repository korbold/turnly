import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../domain/entities/service_log.dart';
import '../../../../shared/constants/colors.dart';
import '../../../../shared/constants/status.dart';

class ServiceLogCard extends StatelessWidget {
  final ServiceLog log;
  final VoidCallback? onComplete;
  final VoidCallback? onTap;

  const ServiceLogCard({
    super.key,
    required this.log,
    this.onComplete,
    this.onTap,
  });

  IconData _paymentIcon(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.cash:
        return Icons.payments_outlined;
      case PaymentMethod.card:
        return Icons.credit_card;
      case PaymentMethod.transfer:
        return Icons.swap_horiz;
      case PaymentMethod.other:
        return Icons.more_horiz;
    }
  }

  String _paymentLabel(PaymentMethod method) {
    return paymentMethodLabels[method.apiValue] ?? method.apiValue;
  }

  Color _statusColor() {
    switch (log.status) {
      case 'in_progress':
        return AppColors.statusInProgress;
      case 'completed':
        return AppColors.statusCompleted;
      default:
        return AppColors.textMuted;
    }
  }

  String _statusLabel() {
    switch (log.status) {
      case 'in_progress':
        return 'En Progreso';
      case 'completed':
        return 'Completado';
      default:
        return log.status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final timeStr = DateFormat('HH:mm').format(log.startedAt);
    final endStr = log.finishedAt != null
        ? DateFormat('HH:mm').format(log.finishedAt!)
        : null;
    final isInProgress = log.status == 'in_progress';

    Widget card = GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time column
            SizedBox(
              width: 50,
              child: Column(
                children: [
                  Text(
                    timeStr,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  if (endStr != null)
                    Text(
                      endStr,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 1,
              height: 60,
              color: AppColors.cardBorder,
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          log.clientResourcePlate ?? 'Sin placa',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      // Status badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _statusColor().withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _statusLabel(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: _statusColor(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    log.serviceName ?? 'Servicio',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (log.attendantName != null) ...[
                        Icon(Icons.person_outline,
                            size: 14, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          log.attendantName!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Icon(_paymentIcon(log.paymentMethod),
                          size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        _paymentLabel(log.paymentMethod),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '\$${log.priceCharged.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  if (isInProgress && onComplete != null) ...[
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.tonal(
                        onPressed: onComplete,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.statusCompleted
                              .withValues(alpha: 0.12),
                          foregroundColor: AppColors.statusCompleted,
                          padding: const EdgeInsets.symmetric(vertical: 6),
                        ),
                        child: const Text(
                          'Completar',
                          style: TextStyle(fontSize: 13),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );

    if (!isInProgress || onComplete == null) return card;

    return Dismissible(
      key: ValueKey('service-log-${log.id}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        onComplete?.call();
        return false;
      },
      background: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: AppColors.statusCompleted,
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Completar',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(width: 8),
            Icon(Icons.done_all, color: Colors.white),
          ],
        ),
      ),
      child: card,
    );
  }
}
