import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../domain/entities/service.dart';
import '../../../../shared/constants/colors.dart';

class ServiceCard extends StatelessWidget {
  final Service service;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  const ServiceCard({
    super.key,
    required this.service,
    this.onTap,
    this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            AspectRatio(
              aspectRatio: 16 / 10,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  service.imageUrl != null && service.imageUrl!.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: service.imageUrl!,
                          fit: BoxFit.cover,
                          placeholder: (_, _) => Container(
                            color: AppColors.primaryMuted,
                            child: const Icon(
                              Icons.local_car_wash,
                              color: AppColors.primary,
                              size: 32,
                            ),
                          ),
                          errorWidget: (_, _, _) => Container(
                            color: AppColors.primaryMuted,
                            child: const Icon(
                              Icons.local_car_wash,
                              color: AppColors.primary,
                              size: 32,
                            ),
                          ),
                        )
                      : Container(
                          color: AppColors.primaryMuted,
                          child: const Icon(
                            Icons.local_car_wash,
                            color: AppColors.primary,
                            size: 32,
                          ),
                        ),
                  // Active/Inactive badge
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: service.isActive
                            ? AppColors.success
                            : AppColors.textMuted,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        service.isActive ? 'Activo' : 'Inactivo',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Info
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    service.name,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '\$${service.price.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                  if (service.description != null &&
                      service.description!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        service.description!,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
