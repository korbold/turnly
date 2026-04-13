import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_theme.dart';

class BusinessDetailScreen extends StatefulWidget {
  final String slug;
  const BusinessDetailScreen({super.key, required this.slug});

  @override
  State<BusinessDetailScreen> createState() => _BusinessDetailScreenState();
}

class _BusinessDetailScreenState extends State<BusinessDetailScreen> {
  final Dio _dio = DioClient.instance;
  Map<String, dynamic>? _tenant;
  List<Map<String, dynamic>> _services = [];
  List<Map<String, dynamic>> _availability = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final response = await _dio.get('/public/tenants/${widget.slug}');
      final data = response.data['data'] as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          _tenant = data['tenant'] as Map<String, dynamic>?;
          _services = (data['services'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
          _availability = (data['availability'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() { _error = 'No se pudo cargar el negocio'; _loading = false; });
      }
    }
  }

  String _dayName(int day) {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    return day >= 0 && day < 7 ? days[day] : '?';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_tenant?['name'] ?? 'Negocio'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: AppColors.bodyText)),
                      const SizedBox(height: 12),
                      OutlinedButton(onPressed: _load, child: const Text('Reintentar')),
                    ],
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    // Business info
                    _buildHeader(),
                    const SizedBox(height: 24),

                    // Services
                    const Text(
                      'Servicios disponibles',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText),
                    ),
                    const SizedBox(height: 12),
                    if (_services.isEmpty)
                      const Text('No hay servicios disponibles', style: TextStyle(color: AppColors.bodyText))
                    else
                      ..._services.map((s) => _ServiceCard(
                        service: s,
                        onBook: () {
                          context.push('/reservations/create', extra: {
                            'slug': widget.slug,
                            'service': s,
                          });
                        },
                      )),

                    const SizedBox(height: 24),

                    // Availability
                    const Text(
                      'Horario de atención',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText),
                    ),
                    const SizedBox(height: 12),
                    _buildAvailability(),
                  ],
                ),
    );
  }

  Widget _buildHeader() {
    final description = _tenant?['description'] as String?;
    final address = _tenant?['address'] as String?;
    final phone = _tenant?['phone'] as String?;
    final businessType = _tenant?['business_type'] as String?;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.store, size: 28, color: AppColors.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _tenant?['name'] ?? '',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.darkText),
                    ),
                    if (businessType != null)
                      Text(
                        businessType,
                        style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (description != null && description.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(description, style: const TextStyle(fontSize: 13, color: AppColors.bodyText)),
          ],
          if (address != null && address.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 14, color: AppColors.bodyText),
                const SizedBox(width: 4),
                Expanded(child: Text(address, style: const TextStyle(fontSize: 12, color: AppColors.bodyText))),
              ],
            ),
          ],
          if (phone != null && phone.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.phone_outlined, size: 14, color: AppColors.bodyText),
                const SizedBox(width: 4),
                Text(phone, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAvailability() {
    if (_availability.isEmpty) {
      return const Text('No hay horario configurado', style: TextStyle(color: AppColors.bodyText));
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Column(
        children: _availability.map((slot) {
          final day = slot['day_of_week'] as int? ?? 0;
          final start = slot['start_time'] as String? ?? '';
          final end = slot['end_time'] as String? ?? '';
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_dayName(day), style: const TextStyle(fontWeight: FontWeight.w500, color: AppColors.darkText)),
                Text(
                  '${start.substring(0, 5)} - ${end.substring(0, 5)}',
                  style: const TextStyle(color: AppColors.bodyText),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final Map<String, dynamic> service;
  final VoidCallback onBook;

  const _ServiceCard({required this.service, required this.onBook});

  @override
  Widget build(BuildContext context) {
    final name = service['name'] as String? ?? 'Servicio';
    final description = service['description'] as String?;
    final price = service['price'];
    final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, width: 0.5),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                    if (description != null && description.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(description, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      price != null ? currency.format(double.tryParse(price.toString()) ?? 0) : 'Consultar',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.primary),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              FilledButton(
                onPressed: onBook,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  minimumSize: Size.zero,
                  textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                child: const Text('Reservar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
