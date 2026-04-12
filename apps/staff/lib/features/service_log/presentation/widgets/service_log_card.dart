import 'package:flutter/material.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../../domain/entities/service_log.dart';
import 'payment_badge.dart';

class ServiceLogCard extends StatelessWidget {
  final ServiceLog serviceLog;
  final VoidCallback? onComplete;

  const ServiceLogCard({super.key, required this.serviceLog, this.onComplete});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Time
            SizedBox(
              width: 48,
              child: Text(
                serviceLog.startedAt.toDisplayTime(),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
            const SizedBox(width: 8),
            // Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        serviceLog.vehiclePlate ?? '---',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace', fontSize: 15),
                      ),
                      const SizedBox(width: 8),
                      if (serviceLog.vehicleBrand != null)
                        Text(serviceLog.vehicleBrand!, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(serviceLog.serviceName ?? 'Servicio', style: const TextStyle(fontSize: 13)),
                  if (serviceLog.attendantName != null) ...[
                    const SizedBox(height: 2),
                    Text(serviceLog.attendantName!, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                  ],
                ],
              ),
            ),
            // Price + status
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '\$${serviceLog.priceCharged.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                const SizedBox(height: 4),
                PaymentBadge(method: serviceLog.paymentMethod),
                const SizedBox(height: 4),
                if (serviceLog.isInProgress && onComplete != null)
                  SizedBox(
                    height: 28,
                    child: ElevatedButton(
                      onPressed: onComplete,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        textStyle: const TextStyle(fontSize: 12),
                        minimumSize: Size.zero,
                      ),
                      child: const Text('Completar'),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: serviceLog.isCompleted ? Colors.green.withValues(alpha: 0.1) : Colors.orange.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      serviceLog.isCompleted ? 'Listo' : 'En curso',
                      style: TextStyle(
                        fontSize: 11,
                        color: serviceLog.isCompleted ? Colors.green : Colors.orange,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
