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
import '../../domain/repositories/reservation_repository.dart';
import '../cubit/create_reservation_cubit.dart';
import '../cubit/create_reservation_state.dart';
import '../widgets/slot_chip.dart';
import '../widgets/step_indicator.dart';

class CreateReservationScreen extends StatelessWidget {
  final String tenantSlug;
  final String? serviceId;
  final List<explore.Service> services;
  final List<Map<String, dynamic>> customFields;
  final String? businessType;

  const CreateReservationScreen({
    super.key,
    required this.tenantSlug,
    this.serviceId,
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
  final List<explore.Service> services;
  final List<Map<String, dynamic>> customFields;
  final String? businessType;

  const _CreateReservationView({
    required this.tenantSlug,
    this.serviceId,
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

  // Whether to skip the resource selection step (no custom fields)
  bool get _skipResourceStep => widget.customFields.isEmpty;
  int get _totalSteps => _skipResourceStep ? 2 : 3;

  // Step 1: Resource
  ClientResource? _selectedResource;

  // Step 2: Service, Date & Slot
  explore.Service? _selectedService;
  DateTime? _selectedDate;
  AvailableSlot? _selectedSlot;

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

  Future<void> _submitReservation() async {
    if (_selectedSlot == null || _selectedService == null) return;
    if (!_skipResourceStep && _selectedResource == null) return;

    context.read<CreateReservationCubit>().createReservation(
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
              setState(() {
                _selectedResource = state.resources.first;
              });
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
            StepIndicator(currentStep: _currentStep, totalSteps: _totalSteps),
            // Step labels
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (!_skipResourceStep)
                    _StepLabel(
                      label: 'Registro',
                      isActive: _currentStep >= 0,
                    ),
                  _StepLabel(
                    label: 'Fecha y hora',
                    isActive: _skipResourceStep
                        ? _currentStep >= 0
                        : _currentStep >= 1,
                  ),
                  _StepLabel(
                    label: 'Confirmar',
                    isActive: _currentStep >= _totalSteps - 1,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
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
                        setState(() => _selectedResource = r);
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
                              setState(() {
                                _selectedResource = state.resources.last;
                              });
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
                    onServiceSelected: (service) {
                      setState(() {
                        _selectedService = service;
                        _selectedSlot = null;
                      });
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

// -- Step Label --
class _StepLabel extends StatelessWidget {
  final String label;
  final bool isActive;

  const _StepLabel({required this.label, required this.isActive});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 11,
        fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
        color: isActive ? AppColors.textPrimary : AppColors.textTertiary,
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
class _Step2DateSlot extends StatelessWidget {
  final List<explore.Service> services;
  final explore.Service? selectedService;
  final bool hasPreselectedService;
  final DateTime? selectedDate;
  final AvailableSlot? selectedSlot;
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
    required this.onServiceSelected,
    required this.onDateSelected,
    required this.onSlotSelected,
    required this.onNext,
  });

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
            label: 'Siguiente',
            onPressed: selectedSlot != null ? onNext : null,
            icon: Icons.arrow_forward_rounded,
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
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

  const _Step3Confirm({
    required this.selectedResource,
    this.selectedService,
    required this.selectedDate,
    required this.selectedSlot,
    required this.notesController,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat("EEEE d 'de' MMMM, yyyy", 'es');
    final timeFormat = DateFormat('HH:mm');

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

          // Summary card
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
                if (selectedService != null) ...[
                  _SummaryRow(
                    icon: Icons.miscellaneous_services_rounded,
                    label: 'Servicio',
                    value: '${selectedService!.name} - \$${selectedService!.price.toStringAsFixed(2)}',
                  ),
                  const Divider(height: 24),
                ],
                _SummaryRow(
                  icon: Icons.badge_outlined,
                  label: 'Registro',
                  value: selectedResource?.label ?? '-',
                ),
                const Divider(height: 24),
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
                      ? '${timeFormat.format(selectedSlot!.start)} - ${timeFormat.format(selectedSlot!.end)}'
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
              return AppButton(
                label: 'Confirmar Reserva',
                onPressed: onSubmit,
                isLoading: state is CreateReservationSubmitting,
                icon: Icons.check_rounded,
              );
            },
          ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
        ],
      ),
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

