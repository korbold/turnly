import 'package:flutter/material.dart';

import '../../../../domain/entities/client_resource.dart';
import '../../../../shared/constants/colors.dart';

class ClientCard extends StatelessWidget {
  final ClientResource client;
  final int? visitCount;
  final DateTime? lastVisit;
  final VoidCallback? onTap;

  const ClientCard({
    super.key,
    required this.client,
    this.visitCount,
    this.lastVisit,
    this.onTap,
  });

  String _lastVisitLabel() {
    if (lastVisit == null) return 'Sin visitas';
    final days = DateTime.now().difference(lastVisit!).inDays;
    if (days == 0) return 'Ultimo servicio: hoy';
    if (days == 1) return 'Ultimo servicio: ayer';
    return 'Ultimo servicio: hace $days dias';
  }

  @override
  Widget build(BuildContext context) {
    final hasPlate = client.plate != null && client.plate!.isNotEmpty;
    final visits = visitCount ?? 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: hasPlate
                    ? AppColors.primaryMuted
                    : AppColors.infoMuted,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                hasPlate ? Icons.directions_car : Icons.person,
                color: hasPlate ? AppColors.primary : AppColors.info,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          hasPlate
                              ? client.plate!
                              : client.clientName ?? 'Cliente #${client.id}',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (visits > 10)
                        const Padding(
                          padding: EdgeInsets.only(left: 4),
                          child: Icon(
                            Icons.star,
                            color: AppColors.warning,
                            size: 18,
                          ),
                        ),
                    ],
                  ),
                  if (hasPlate && client.clientName != null)
                    Text(
                      client.clientName!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  if (client.brand != null || client.model != null)
                    Text(
                      [client.brand, client.model]
                          .where((e) => e != null)
                          .join(' '),
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        _lastVisitLabel(),
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                      ),
                      if (visits > 0) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 1,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primaryMuted,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '$visits visitas',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),

            const Icon(
              Icons.chevron_right,
              color: AppColors.textMuted,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
