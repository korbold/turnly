import 'package:flutter/material.dart';

import '../../../../domain/entities/service_log.dart';
import '../../../../injection.dart';
import '../../../../application/use_cases/service_logs/complete_service_log_use_case.dart';
import '../../../../shared/constants/colors.dart';

class LiveTrackerWidget extends StatelessWidget {
  final List<ServiceLog> logs;

  const LiveTrackerWidget({super.key, required this.logs});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'En progreso',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const Spacer(),
            Text(
              '${logs.length}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (logs.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 40),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Column(
              children: [
                const Icon(Icons.check_circle_outline,
                    size: 40, color: AppColors.textMuted),
                const SizedBox(height: 8),
                Text(
                  'Sin servicios en progreso',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppColors.textMuted,
                      ),
                ),
              ],
            ),
          )
        else
          ...logs.map((log) => _LiveServiceCard(log: log)),
      ],
    );
  }
}

class _LiveServiceCard extends StatelessWidget {
  final ServiceLog log;

  const _LiveServiceCard({required this.log});

  String _elapsedMinutes() {
    final elapsed = DateTime.now().difference(log.startedAt);
    return '${elapsed.inMinutes}min';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.statusInProgressBg),
      ),
      child: Row(
        children: [
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  log.clientResourcePlate ?? log.clientResourceBrand ?? 'Cliente',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontSize: 14,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  log.serviceName ?? 'Servicio',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (log.attendantName != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    log.attendantName!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textMuted,
                        ),
                  ),
                ],
              ],
            ),
          ),

          // Timer
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.statusInProgressBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '\u23F1 ${_elapsedMinutes()}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.statusInProgress,
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Complete button
          SizedBox(
            height: 34,
            child: ElevatedButton(
              onPressed: () async {
                try {
                  await getIt<CompleteServiceLogUseCase>().call(log.id);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Servicio completado'),
                        backgroundColor: AppColors.success,
                      ),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(e.toString()),
                        backgroundColor: AppColors.error,
                      ),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.success,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                textStyle: const TextStyle(fontSize: 12),
              ),
              child: const Text('Completar'),
            ),
          ),
        ],
      ),
    );
  }
}
