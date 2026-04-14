import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/category_colors.dart';

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
  bool _hoursExpanded = false;

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
    const days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
    return day >= 0 && day < 7 ? days[day] : '?';
  }

  bool _isTodayDay(int day) {
    return (DateTime.now().weekday - 1) == day;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, style: const TextStyle(color: AppColors.bodyText)),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _load, child: const Text('Reintentar')),
            ],
          ),
        ),
      );
    }

    final businessType = _tenant?['business_type'] as String?;
    final style = CategoryColors.get(businessType);
    final name = _tenant?['name'] as String? ?? '';
    final description = _tenant?['description'] as String?;
    final address = _tenant?['address'] as String?;
    final phone = _tenant?['phone'] as String?;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [style.background.withValues(alpha: 0.4), Colors.transparent],
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Row(
                        children: [
                          IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back)),
                        ],
                      ),
                    ),
                    Container(
                      width: 80, height: 80,
                      decoration: BoxDecoration(color: style.background, borderRadius: BorderRadius.circular(24)),
                      child: Icon(style.icon, size: 36, color: style.iconColor),
                    ),
                    const SizedBox(height: 16),
                    Text(name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.darkText)),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(color: style.background, borderRadius: BorderRadius.circular(8)),
                      child: Text(style.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: style.iconColor)),
                    ),
                    if (address != null && address.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.location_on_outlined, size: 14, color: AppColors.bodyText),
                          const SizedBox(width: 4),
                          Text(address, style: const TextStyle(fontSize: 13, color: AppColors.bodyText)),
                        ],
                      ),
                    ],
                    if (phone != null && phone.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.phone_outlined, size: 14, color: AppColors.bodyText),
                          const SizedBox(width: 4),
                          Text(phone, style: const TextStyle(fontSize: 13, color: AppColors.bodyText)),
                        ],
                      ),
                    ],
                    if (description != null && description.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(description, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.bodyText)),
                      ),
                    ],
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Text('Servicios (${_services.length})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.darkText)),
            ),
          ),
          if (_services.isEmpty)
            const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Text('No hay servicios disponibles', style: TextStyle(color: AppColors.bodyText))))
          else
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(20), boxShadow: AppColors.cardShadow),
                  child: Column(
                    children: _services.asMap().entries.map((entry) {
                      final i = entry.key;
                      final s = entry.value;
                      final sName = s['name'] as String? ?? 'Servicio';
                      final sDesc = s['description'] as String?;
                      final price = s['price'];
                      final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);
                      return Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(sName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                                      if (sDesc != null && sDesc.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(sDesc, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: AppColors.bodyText)),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    if (price != null)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                        decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(8)),
                                        child: Text(currency.format(double.tryParse(price.toString()) ?? 0), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
                                      ),
                                    const SizedBox(height: 8),
                                    GestureDetector(
                                      onTap: () {
                                        context.push('/reservations/create', extra: {'slug': widget.slug, 'service': s, 'custom_fields': _tenant?['custom_fields']});
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                        decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(20)),
                                        child: const Text('Reservar', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          if (i < _services.length - 1) const Divider(height: 1, indent: 16, endIndent: 16),
                        ],
                      );
                    }).toList(),
                  ),
                ),
              ),
            ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
              child: Container(
                decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(20), boxShadow: AppColors.cardShadow),
                child: Column(
                  children: [
                    InkWell(
                      onTap: () => setState(() => _hoursExpanded = !_hoursExpanded),
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const Text('Horarios', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                            const Spacer(),
                            Icon(_hoursExpanded ? Icons.expand_less : Icons.expand_more, color: AppColors.bodyText),
                          ],
                        ),
                      ),
                    ),
                    if (_hoursExpanded) ...[
                      const Divider(height: 1),
                      if (_availability.isEmpty)
                        const Padding(padding: EdgeInsets.all(16), child: Text('No hay horario configurado', style: TextStyle(color: AppColors.bodyText)))
                      else
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                          child: Column(
                            children: () {
                              final Map<int, List<Map<String, dynamic>>> grouped = {};
                              for (final slot in _availability) {
                                final day = slot['day_of_week'] as int? ?? 0;
                                grouped.putIfAbsent(day, () => []);
                                grouped[day]!.add(slot);
                              }
                              final days = grouped.keys.toList()..sort();
                              return days.map((day) {
                                final slots = grouped[day]!;
                                final times = slots.map((s) {
                                  final start = (s['start_time'] as String? ?? '').substring(0, 5);
                                  final end = (s['end_time'] as String? ?? '').substring(0, 5);
                                  return '$start - $end';
                                }).join('  /  ');
                                final isToday = _isTodayDay(day);
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 6),
                                  child: Row(
                                    children: [
                                      if (isToday)
                                        Container(width: 6, height: 6, margin: const EdgeInsets.only(right: 8), decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle)),
                                      SizedBox(width: 80, child: Text(_dayName(day), style: TextStyle(fontWeight: isToday ? FontWeight.w700 : FontWeight.w500, color: AppColors.darkText))),
                                      Expanded(child: Text(times, style: const TextStyle(color: AppColors.bodyText), textAlign: TextAlign.right)),
                                    ],
                                  ),
                                );
                              }).toList();
                            }(),
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
