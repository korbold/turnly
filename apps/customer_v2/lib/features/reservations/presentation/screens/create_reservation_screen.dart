// lib/features/reservations/presentation/screens/create_reservation_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../explore/domain/entities/service.dart' as explore;
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/shimmer_loader.dart';
import '../../../resources/domain/entities/client_resource.dart';
import '../../../resources/domain/repositories/resource_repository.dart';
import '../../../resources/presentation/cubit/resources_cubit.dart';
import '../../../resources/presentation/cubit/resources_state.dart';
import '../../domain/entities/available_slot.dart';
import '../../domain/entities/booking_item.dart';
import '../../domain/repositories/reservation_repository.dart';
import '../cubit/create_reservation_cubit.dart';
import '../cubit/create_reservation_state.dart';
import '../widgets/slot_chip.dart';
import '../widgets/step_indicator.dart';
import '../../../../core/widgets/offline_action_gate.dart';

class CreateReservationScreen extends StatelessWidget {
  final String tenantSlug;
  final String? serviceId;
  final String? serviceVariantId;
  final List<explore.Service> services;
  final List<Map<String, dynamic>> customFields;
  final String? businessType;

  const CreateReservationScreen({
    super.key,
    required this.tenantSlug,
    this.serviceId,
    this.serviceVariantId,
    this.services = const [],
    this.customFields = const [],
    this.businessType,
  });

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (_) =>
              ResourcesCubit(getIt<ResourceRepository>())..loadResources(),
        ),
        BlocProvider(
          create: (_) =>
              CreateReservationCubit(getIt<ReservationRepository>()),
        ),
      ],
      child: Builder(
        builder: (context) {
          final tenantTheme = TenantTheme.fromBusinessType(businessType);
          return Theme(
            data: Theme.of(context).copyWith(
              colorScheme: Theme.of(context).colorScheme.copyWith(
                primary: tenantTheme.primary,
                secondary: tenantTheme.secondary,
              ),
            ),
            child: _CreateReservationView(
              tenantSlug: tenantSlug,
              serviceId: serviceId,
              serviceVariantId: serviceVariantId,
              services: services,
              customFields: customFields,
              businessType: businessType,
            ),
          );
        },
      ),
    );
  }
}

class _CreateReservationView extends StatefulWidget {
  final String tenantSlug;
  final String? serviceId;
  final String? serviceVariantId;
  final List<explore.Service> services;
  final List<Map<String, dynamic>> customFields;
  final String? businessType;

  const _CreateReservationView({
    required this.tenantSlug,
    this.serviceId,
    this.serviceVariantId,
    this.services = const [],
    this.customFields = const [],
    this.businessType,
  });

  @override
  State<_CreateReservationView> createState() => _CreateReservationViewState();
}

class _CreateReservationViewState extends State<_CreateReservationView> {
  final _pageController = PageController();
  int _currentStep = 0;

  // Whether to skip the resource selection step (no usable custom fields)
  bool get _skipResourceStep =>
      widget.customFields
          .where((f) => (f['label'] as String?)?.trim().isNotEmpty == true)
          .isEmpty;
  int get _totalSteps => _skipResourceStep ? 2 : 3;

  // Step 1: Resource
  ClientResource? _selectedResource;

  // Step 2: Service, Date & Slot
  explore.Service? _selectedService;
  DateTime? _selectedDate;
  AvailableSlot? _selectedSlot;

  // Phase 3.7 — variant the backend matched to the chosen resource.
  // Null when the tenant has no segmentation field, the resource lacks
  // the value, or no variant label fits. In that case the user must
  // pick manually in step 2.
  explore.ServiceVariantOption? _resolvedVariant;
  bool _resolvingVariant = false;
  String? _lastResolvedFor;

  // Step 3: Notes
  final _notesController = TextEditingController();

  // Scroll controller for step 1
  final _step1ScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    if (widget.serviceId != null && widget.services.isNotEmpty) {
      _selectedService = widget.services.where((s) => s.id == widget.serviceId).firstOrNull;
    }
    if (_selectedService == null && widget.services.length == 1) {
      _selectedService = widget.services.first;
    }

    // Seed the cubit's cart with the initially-tapped service so the
    // multi-item endpoint sees at least one row. If a variant was
    // picked up-stream (size/type selector before this screen), the
    // BookingItem carries its label + price + duration so totals match
    // exactly what the customer saw.
    if (_selectedService != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final svc = _selectedService!;
        final variant = widget.serviceVariantId == null
            ? null
            : svc.variants
                .where((v) => v.id == widget.serviceVariantId)
                .cast<explore.ServiceVariantOption?>()
                .firstWhere((v) => v != null, orElse: () => null);

        context.read<CreateReservationCubit>().seedCart([
          BookingItem(
            serviceId: svc.id,
            serviceVariantId: variant?.id,
            label: variant == null ? svc.name : '${svc.name} · ${variant.label}',
            price: variant?.price ?? svc.price,
            durationMin: variant?.durationMin ?? svc.durationMinutes,
          ),
        ]);
      });
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _notesController.dispose();
    _step1ScrollController.dispose();
    super.dispose();
  }

  void _goToStep(int step) {
    setState(() => _currentStep = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
    );
  }

  void _nextStep() {
    if (_currentStep < _totalSteps - 1) {
      _goToStep(_currentStep + 1);
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      _goToStep(_currentStep - 1);
    } else {
      context.pop();
    }
  }

  void _loadSlots() {
    if (_selectedDate == null || _selectedService == null) return;
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate!);
    context.read<CreateReservationCubit>().loadSlots(
          dateStr,
          _selectedService!.id,
        );
  }

  Future<void> _resolveVariantForResource(ClientResource resource) async {
    final svc = _selectedService;
    if (svc == null || !svc.hasVariants) return;
    if (_lastResolvedFor == '${svc.id}:${resource.id}') return;

    setState(() {
      _resolvingVariant = true;
      _lastResolvedFor = '${svc.id}:${resource.id}';
    });

    final repo = getIt<ReservationRepository>();
    final result = await repo.fetchSuggestedVariant(
      serviceId: svc.id,
      clientResourceId: resource.id,
    );

    if (!mounted) return;
    result.match(
      (_) => setState(() {
        _resolvingVariant = false;
        _resolvedVariant = null;
      }),
      (variant) {
        setState(() {
          _resolvingVariant = false;
          _resolvedVariant = variant;
        });
        if (variant != null) _reseedCart(variant);
      },
    );
  }

  void _reseedCart(explore.ServiceVariantOption? variant) {
    final svc = _selectedService;
    if (svc == null) return;
    context.read<CreateReservationCubit>().seedCart([
      BookingItem(
        serviceId: svc.id,
        serviceVariantId: variant?.id,
        label: variant == null ? svc.name : '${svc.name} · ${variant.label}',
        price: variant?.price ?? svc.price,
        durationMin: variant?.durationMin ?? svc.durationMinutes,
      ),
    ]);
  }

  Future<void> _pickVariantManually() async {
    final svc = _selectedService;
    if (svc == null || !svc.hasVariants) return;
    final picked = await showVariantPickerSheet(context, svc);
    if (!mounted || picked == null) return;
    setState(() => _resolvedVariant = picked);
    _reseedCart(picked);
  }

  Future<void> _submitReservation() async {
    if (_selectedSlot == null || _selectedService == null) return;
    if (!_skipResourceStep && _selectedResource == null) return;

    // Guard: every cart line whose service has size/type variants must
    // carry the picked variantId. Otherwise the backend rejects with
    // items.*.service_variant_id => required_with.
    final cart = context.read<CreateReservationCubit>().cart;
    final servicesById = {for (final s in widget.services) s.id: s};
    final missing = cart.where((it) {
      final svc = servicesById[it.serviceId];
      return (svc?.hasVariants ?? false) && it.serviceVariantId == null;
    }).toList();
    if (missing.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Elige tamaño para: ${missing.map((m) => m.label).join(", ")}',
          ),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    context.read<CreateReservationCubit>().createReservation(
          tenantSlug: widget.tenantSlug,
          clientResourceId: _selectedResource?.id,
          serviceId: _selectedService!.id,
          scheduledAt: DateFormat('yyyy-MM-dd HH:mm:ss').format(_selectedSlot!.start),
          notes: _notesController.text.trim().isNotEmpty
              ? _notesController.text.trim()
              : null,
        );
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocListener(
      listeners: [
        BlocListener<CreateReservationCubit, CreateReservationState>(
          listener: (context, state) {
            if (state is CreateReservationSuccess) {
              _showSuccessDialog(state.reservation.id);
            } else if (state is CreateReservationError) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(state.message),
                  backgroundColor: AppColors.error,
                ),
              );
            }
          },
        ),
        BlocListener<ResourcesCubit, ResourcesState>(
          listener: (context, state) {
            if (state is ResourcesLoaded &&
                state.resources.isNotEmpty &&
                _selectedResource == null) {
              final first = state.resources.first;
              setState(() {
                _selectedResource = first;
              });
              _resolveVariantForResource(first);
            }
          },
        ),
      ],
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.surface,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: _previousStep,
          ),
          title: const Text(
            'Nueva Reserva',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          centerTitle: true,
        ),
        body: Column(
          children: [
            StepIndicator(
              currentStep: _currentStep,
              totalSteps: _totalSteps,
              labels: _skipResourceStep
                  ? const ['Fecha', 'Confirmar']
                  : const ['Registro', 'Fecha', 'Confirmar'],
              onStepTap: (i) {
                if (i <= _currentStep) _goToStep(i);
              },
            ),
            const SizedBox(height: 12),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  if (!_skipResourceStep)
                    _Step1ResourceSelection(
                      selectedResource: _selectedResource,
                      scrollController: _step1ScrollController,
                      onResourceSelected: (r) {
                        setState(() {
                          _selectedResource = r;
                          _resolvedVariant = null;
                          _lastResolvedFor = null;
                        });
                        _resolveVariantForResource(r);
                      },
                      onCreateResource: () async {
                        final result = await context.push(
                          '/resources/add',
                          extra: {
                            'customFields': widget.customFields,
                            'businessType': widget.businessType,
                          },
                        );
                        if (result == true && mounted) {
                          context.read<ResourcesCubit>().loadResources();
                          // Wait for resources to reload, then select the last one
                          await Future.delayed(const Duration(milliseconds: 500));
                          if (mounted) {
                            final state = context.read<ResourcesCubit>().state;
                            if (state is ResourcesLoaded && state.resources.isNotEmpty) {
                              final last = state.resources.last;
                              setState(() {
                                _selectedResource = last;
                                _resolvedVariant = null;
                                _lastResolvedFor = null;
                              });
                              _resolveVariantForResource(last);
                            }
                          }
                        }
                      },
                      onEditResource: (resource) async {
                        final result = await context.push(
                          '/resources/add',
                          extra: {
                            'customFields': widget.customFields,
                            'resource': resource,
                            'businessType': widget.businessType,
                          },
                        );
                        if (result == true && mounted) {
                          context.read<ResourcesCubit>().loadResources();
                        }
                      },
                      onDeleteResource: (resource) async {
                        final confirmed = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                            title: const Text('Eliminar registro'),
                            content: Text('Eliminar "${resource.label}"?'),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                style: TextButton.styleFrom(foregroundColor: AppColors.error),
                                child: const Text('Eliminar'),
                              ),
                            ],
                          ),
                        );
                        if (confirmed == true && mounted) {
                          await context.read<ResourcesCubit>().deleteResource(resource.id);
                          if (mounted && _selectedResource?.id == resource.id) {
                            setState(() => _selectedResource = null);
                          }
                        }
                      },
                      onNext: () {
                        if (_selectedResource != null) _nextStep();
                      },
                    ),
                  _Step2DateSlot(
                    services: widget.services,
                    selectedService: _selectedService,
                    hasPreselectedService: widget.serviceId != null,
                    selectedDate: _selectedDate,
                    selectedSlot: _selectedSlot,
                    resolvedVariant: _resolvedVariant,
                    resolvingVariant: _resolvingVariant,
                    onChangeVariant: _pickVariantManually,
                    onServiceSelected: (service) {
                      setState(() {
                        _selectedService = service;
                        _selectedSlot = null;
                        _resolvedVariant = null;
                        _lastResolvedFor = null;
                      });
                      if (_selectedResource != null) {
                        _resolveVariantForResource(_selectedResource!);
                      }
                      _loadSlots();
                    },
                    onDateSelected: (date) {
                      setState(() {
                        _selectedDate = date;
                        _selectedSlot = null;
                      });
                      _loadSlots();
                    },
                    onSlotSelected: (slot) {
                      setState(() => _selectedSlot = slot);
                    },
                    onNext: () {
                      if (_selectedSlot != null) _nextStep();
                    },
                  ),
                  _Step3Confirm(
                    selectedResource: _selectedResource,
                    selectedService: _selectedService,
                    selectedDate: _selectedDate,
                    selectedSlot: _selectedSlot,
                    notesController: _notesController,
                    onSubmit: _submitReservation,
                    availableServices: widget.services,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSuccessDialog(String reservationId) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: AppColors.success,
                size: 48,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Reserva creada',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Tu reserva ha sido registrada exitosamente.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            AppButton(
              label: 'Ver reserva',
              onPressed: () {
                Navigator.of(ctx).pop();
                context.go('/reservations/$reservationId');
              },
            ),
          ],
        ),
      ),
    );
  }
}

// -- Step 1: Resource Selection --
class _Step1ResourceSelection extends StatelessWidget {
  final ClientResource? selectedResource;
  final ScrollController scrollController;
  final ValueChanged<ClientResource> onResourceSelected;
  final VoidCallback onCreateResource;
  final ValueChanged<ClientResource> onEditResource;
  final ValueChanged<ClientResource> onDeleteResource;
  final VoidCallback onNext;

  const _Step1ResourceSelection({
    required this.selectedResource,
    required this.scrollController,
    required this.onResourceSelected,
    required this.onCreateResource,
    required this.onEditResource,
    required this.onDeleteResource,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      controller: scrollController,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Selecciona un registro',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ).animate().fadeIn(duration: 400.ms),
          const SizedBox(height: 4),
          const Text(
            'Elige el registro para esta reserva',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 50.ms),
          const SizedBox(height: 20),

          // Resource list
          BlocBuilder<ResourcesCubit, ResourcesState>(
            builder: (context, state) {
              if (state is ResourcesLoading || state is ResourcesInitial) {
                return ShimmerLoader.list(count: 3, itemHeight: 64);
              }

              if (state is ResourcesError) {
                return EmptyState(
                  icon: Icons.error_outline_rounded,
                  title: 'Error al cargar registros',
                  subtitle: state.message,
                  actionLabel: 'Reintentar',
                  onAction: () =>
                      context.read<ResourcesCubit>().loadResources(),
                );
              }

              if (state is ResourcesLoaded) {
                if (state.resources.isEmpty) {
                  return Column(
                    children: [
                      const EmptyState(
                        icon: Icons.badge_outlined,
                        title: 'Sin registros',
                        subtitle:
                            'Crea un registro para poder hacer una reserva',
                      ),
                    ],
                  );
                }

                return Column(
                  children: state.resources.map((resource) {
                    final isSelected = selectedResource?.id == resource.id;
                    return _ResourceCard(
                      resource: resource,
                      isSelected: isSelected,
                      onTap: () => onResourceSelected(resource),
                      onEdit: () => onEditResource(resource),
                      onDelete: () => onDeleteResource(resource),
                    );
                  }).toList(),
                );
              }

              return const SizedBox.shrink();
            },
          ),

          const SizedBox(height: 24),
          // Create new resource button
          OutlinedButton.icon(
            onPressed: onCreateResource,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Crear nuevo registro'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              side: BorderSide(color: Theme.of(context).colorScheme.primary),
              foregroundColor: Theme.of(context).colorScheme.primary,
              textStyle: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms),

          const SizedBox(height: 32),
          AppButton(
            label: 'Siguiente',
            onPressed: selectedResource != null ? onNext : null,
            icon: Icons.arrow_forward_rounded,
          ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
        ],
      ),
    );
  }
}

class _ResourceCard extends StatelessWidget {
  final ClientResource resource;
  final bool isSelected;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _ResourceCard({
    required this.resource,
    required this.isSelected,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? primary.withValues(alpha: 0.06)
              : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? primary : AppColors.border,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: isSelected
                    ? primary.withValues(alpha: 0.1)
                    : AppColors.divider,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.badge_outlined,
                color: isSelected ? primary : AppColors.textTertiary,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                resource.label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? primary : AppColors.textPrimary,
                ),
              ),
            ),
            if (isSelected)
              Icon(Icons.check_circle_rounded, color: primary, size: 22),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onEdit,
              child: const Icon(
                Icons.edit_outlined,
                color: AppColors.textTertiary,
                size: 18,
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onDelete,
              child: const Icon(
                Icons.delete_outline_rounded,
                color: AppColors.textTertiary,
                size: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// -- Step 2: Date & Slot Selection --
Future<explore.ServiceVariantOption?> showVariantPickerSheet(
  BuildContext context,
  explore.Service service,
) {
  final primary = Theme.of(context).colorScheme.primary;
  return showModalBottomSheet<explore.ServiceVariantOption>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetCtx) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                service.name,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              const Text(
                'Elige una opción',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              ...service.variants.map(
                (v) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(v.label),
                  subtitle: Text(
                    '\$${v.price.toStringAsFixed(2)} · ${v.durationMin} min',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: Icon(Icons.chevron_right_rounded, color: primary),
                  onTap: () => Navigator.pop(sheetCtx, v),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _Step2DateSlot extends StatelessWidget {
  final List<explore.Service> services;
  final explore.Service? selectedService;
  final bool hasPreselectedService;
  final DateTime? selectedDate;
  final AvailableSlot? selectedSlot;
  final explore.ServiceVariantOption? resolvedVariant;
  final bool resolvingVariant;
  final VoidCallback onChangeVariant;
  final ValueChanged<explore.Service> onServiceSelected;
  final ValueChanged<DateTime> onDateSelected;
  final ValueChanged<AvailableSlot> onSlotSelected;
  final VoidCallback onNext;

  const _Step2DateSlot({
    required this.services,
    required this.selectedService,
    this.hasPreselectedService = false,
    required this.selectedDate,
    required this.selectedSlot,
    required this.resolvedVariant,
    required this.resolvingVariant,
    required this.onChangeVariant,
    required this.onServiceSelected,
    required this.onDateSelected,
    required this.onSlotSelected,
    required this.onNext,
  });

  bool get _needsVariant =>
      (selectedService?.hasVariants ?? false) && resolvedVariant == null;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat("EEEE d 'de' MMMM", 'es');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Selecciona fecha y hora',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ).animate().fadeIn(duration: 400.ms),
          const SizedBox(height: 20),

          // Service selection (only if not pre-selected)
          if (services.length > 1 && !hasPreselectedService) ...[
            const Text(
              'Servicio',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: services.map((service) {
                final isSelected = selectedService?.id == service.id;
                final primary = Theme.of(context).colorScheme.primary;
                return GestureDetector(
                  onTap: () => onServiceSelected(service),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: isSelected ? primary.withValues(alpha: 0.1) : AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected ? primary : AppColors.border,
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          service.name,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isSelected ? primary : AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '\$${service.price.toStringAsFixed(2)}',
                          style: TextStyle(
                            fontSize: 12,
                            color: isSelected ? primary : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ).animate().fadeIn(duration: 400.ms, delay: 50.ms),
            const SizedBox(height: 24),
          ],

          if (selectedService?.hasVariants ?? false) ...[
            _VariantSection(
              variant: resolvedVariant,
              loading: resolvingVariant,
              onChange: onChangeVariant,
            ).animate().fadeIn(duration: 400.ms, delay: 75.ms),
            const SizedBox(height: 24),
          ],

          // Date picker button
          GestureDetector(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: selectedDate ?? DateTime.now(),
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 90)),
              );
              if (picked != null) onDateSelected(picked);
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .primary
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.calendar_today_rounded,
                      color: Theme.of(context).colorScheme.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      selectedDate != null
                          ? dateFormat.format(selectedDate!)
                          : 'Seleccionar fecha',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: selectedDate != null
                            ? AppColors.textPrimary
                            : AppColors.textTertiary,
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded,
                      color: AppColors.textTertiary),
                ],
              ),
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 100.ms),

          const SizedBox(height: 24),

          // Slots section
          if (selectedDate != null && selectedService != null) ...[
            const Text(
              'Horarios disponibles',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            BlocBuilder<CreateReservationCubit, CreateReservationState>(
              builder: (context, state) {
                if (state is CreateReservationLoadingSlots) {
                  return ShimmerLoader.list(count: 2, itemHeight: 48);
                }

                if (state is CreateReservationError) {
                  return EmptyState(
                    icon: Icons.error_outline_rounded,
                    title: 'Error al cargar horarios',
                    subtitle: state.message,
                  );
                }

                if (state is CreateReservationSlotsLoaded) {
                  if (state.slots.isEmpty) {
                    return const EmptyState(
                      icon: Icons.event_busy_rounded,
                      title: 'Sin horarios disponibles',
                      subtitle: 'Prueba con otra fecha',
                    );
                  }

                  return Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: state.slots.map((slot) {
                      return SlotChip(
                        slot: slot,
                        isSelected: selectedSlot?.start == slot.start,
                        onTap: () => onSlotSelected(slot),
                      );
                    }).toList(),
                  ).animate().fadeIn(duration: 300.ms);
                }

                return const SizedBox.shrink();
              },
            ),
          ],

          const SizedBox(height: 32),
          AppButton(
            label: _needsVariant ? 'Elige tamaño' : 'Siguiente',
            onPressed: (_needsVariant)
                ? onChangeVariant
                : (selectedSlot != null ? onNext : null),
            icon: _needsVariant
                ? Icons.tune_rounded
                : Icons.arrow_forward_rounded,
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
        ],
      ),
    );
  }
}

class _VariantSection extends StatelessWidget {
  final explore.ServiceVariantOption? variant;
  final bool loading;
  final VoidCallback onChange;

  const _VariantSection({
    required this.variant,
    required this.loading,
    required this.onChange,
  });

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.straighten_rounded, color: primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Tamaño',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                if (loading)
                  const Text(
                    'Sugiriendo según tu registro…',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textTertiary,
                    ),
                  )
                else if (variant != null)
                  Text(
                    '${variant!.label} · \$${variant!.price.toStringAsFixed(2)} · ${variant!.durationMin} min',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  )
                else
                  const Text(
                    'Elige una opción',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
              ],
            ),
          ),
          TextButton(
            onPressed: loading ? null : onChange,
            child: Text(variant == null ? 'Elegir' : 'Cambiar'),
          ),
        ],
      ),
    );
  }
}

// -- Step 3: Confirm --
class _Step3Confirm extends StatelessWidget {
  final ClientResource? selectedResource;
  final explore.Service? selectedService;
  final DateTime? selectedDate;
  final AvailableSlot? selectedSlot;
  final TextEditingController notesController;
  final VoidCallback onSubmit;
  final List<explore.Service> availableServices;

  const _Step3Confirm({
    required this.selectedResource,
    this.selectedService,
    required this.selectedDate,
    required this.selectedSlot,
    required this.notesController,
    required this.onSubmit,
    required this.availableServices,
  });

  Future<explore.ServiceVariantOption?> _pickVariantInline(
    BuildContext context,
    explore.Service service,
  ) {
    final primary = Theme.of(context).colorScheme.primary;
    return showModalBottomSheet<explore.ServiceVariantOption>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service.name,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Elige una opción',
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                ...service.variants.map(
                  (v) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(v.label),
                    subtitle: Text(
                      '\$${v.price.toStringAsFixed(2)} · ${v.durationMin} min',
                      style: const TextStyle(fontSize: 12),
                    ),
                    trailing: Icon(Icons.chevron_right_rounded, color: primary),
                    onTap: () => Navigator.pop(sheetCtx, v),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _openServicePicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        final cubit = context.read<CreateReservationCubit>();
        final added = cubit.cart.map((c) => c.serviceId).toSet();
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Agregar servicio',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: availableServices.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final s = availableServices[i];
                      final alreadyInCart = added.contains(s.id);
                      final priceLabel = s.hasVariants
                          ? 'Desde \$${s.displayPrice.toStringAsFixed(2)}'
                          : '\$${s.price.toStringAsFixed(2)}';
                      return ListTile(
                        title: Text(s.name),
                        subtitle: Text(
                          '$priceLabel · ${s.durationMinutes} min',
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: alreadyInCart
                            ? const Icon(Icons.check_circle, color: Colors.green, size: 20)
                            : const Icon(Icons.add_circle_outline, size: 20),
                        onTap: () async {
                          Navigator.of(sheetCtx).pop();
                          if (!context.mounted) return;

                          if (s.hasVariants) {
                            // Try the backend's VariantSuggester first
                            // (Phase 3.7) — it matches the customer's
                            // selected resource (vehicle/pet/etc.) to a
                            // variant via the tenant's variant_map. Only
                            // open the manual picker when it can't decide.
                            explore.ServiceVariantOption? variant;
                            final resourceId = selectedResource?.id;
                            if (resourceId != null) {
                              final res = await getIt<ReservationRepository>()
                                  .fetchSuggestedVariant(
                                serviceId: s.id,
                                clientResourceId: resourceId,
                              );
                              variant = res.fold((_) => null, (v) => v);
                            }
                            if (variant == null) {
                              if (!context.mounted) return;
                              variant = await _pickVariantInline(context, s);
                              if (variant == null) return;
                            }
                            cubit.addToCart(BookingItem(
                              serviceId: s.id,
                              serviceVariantId: variant.id,
                              label: '${s.name} · ${variant.label}',
                              price: variant.price,
                              durationMin: variant.durationMin,
                            ));
                          } else {
                            cubit.addToCart(BookingItem(
                              serviceId: s.id,
                              label: s.name,
                              price: s.price,
                              durationMin: s.durationMinutes,
                            ));
                          }
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat("EEEE d 'de' MMMM, yyyy", 'es');
    final timeFormat = DateFormat('HH:mm');
    final primary = Theme.of(context).colorScheme.primary;

    return BlocBuilder<CreateReservationCubit, CreateReservationState>(
      buildWhen: (_, __) => true,
      builder: (context, _) {
        final cubit = context.read<CreateReservationCubit>();
        final cart = cubit.cart;
        final hasCart = cart.isNotEmpty;

        return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Confirmar reserva',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ).animate().fadeIn(duration: 400.ms),
          const SizedBox(height: 4),
          const Text(
            'Revisa los detalles antes de confirmar',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 50.ms),
          const SizedBox(height: 24),

          // Services cart
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.miscellaneous_services_rounded,
                        color: primary, size: 18),
                    const SizedBox(width: 8),
                    const Text(
                      'Servicios',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textTertiary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const Spacer(),
                    if (hasCart)
                      Text(
                        '${cubit.totalDurationMin} min',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textTertiary,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                if (!hasCart && selectedService != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text(
                      '${selectedService!.name} · \$${selectedService!.price.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                for (var i = 0; i < cart.length; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            cart[i].qty > 1
                                ? '${cart[i].label} × ${cart[i].qty}'
                                : cart[i].label,
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '\$${cart[i].lineTotal.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (cart.length > 1)
                          IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () => cubit.removeFromCart(i),
                            visualDensity: VisualDensity.compact,
                          ),
                      ],
                    ),
                  ),
                if (availableServices.length > 1) ...[
                  const SizedBox(height: 4),
                  TextButton.icon(
                    onPressed: () => _openServicePicker(context),
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Agregar otro servicio'),
                    style: TextButton.styleFrom(
                      foregroundColor: primary,
                      padding: EdgeInsets.zero,
                      alignment: Alignment.centerLeft,
                    ),
                  ),
                ],
                if (hasCart) ...[
                  const Divider(height: 24),
                  Row(
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '\$${cubit.totalPrice.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: primary,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ).animate().fadeIn(duration: 300.ms, delay: 80.ms),

          const SizedBox(height: 16),

          // Resource / Date / Time summary
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                if (selectedResource != null) ...[
                  _SummaryRow(
                    icon: Icons.badge_outlined,
                    label: 'Registro',
                    value: selectedResource!.label,
                  ),
                  const Divider(height: 24),
                ],
                _SummaryRow(
                  icon: Icons.calendar_today_rounded,
                  label: 'Fecha',
                  value: selectedDate != null
                      ? dateFormat.format(selectedDate!)
                      : '-',
                ),
                const Divider(height: 24),
                _SummaryRow(
                  icon: Icons.access_time_rounded,
                  label: 'Hora',
                  value: selectedSlot != null
                      ? timeFormat.format(selectedSlot!.start)
                      : '-',
                ),
              ],
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 100.ms),

          const SizedBox(height: 24),

          // Notes
          AppTextField(
            label: 'Notas (opcional)',
            hint: 'Agrega instrucciones o comentarios...',
            controller: notesController,
            maxLines: 3,
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms),

          const SizedBox(height: 32),

          BlocBuilder<CreateReservationCubit, CreateReservationState>(
            builder: (context, state) {
              return OfflineActionGate(
                reason: 'para confirmar esta reserva',
                child: AppButton(
                  label: 'Confirmar Reserva',
                  onPressed: onSubmit,
                  isLoading: state is CreateReservationSubmitting,
                  icon: Icons.check_rounded,
                ),
              );
            },
          ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
        ],
      ),
    );
      },
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _SummaryRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: primary, size: 18),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textTertiary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

