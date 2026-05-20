// lib/core/widgets/offline_banner.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../connectivity/connectivity_cubit.dart';
import '../connectivity/connectivity_state.dart';
import '../../app/theme/app_colors.dart';

class OfflineBanner extends StatefulWidget {
  const OfflineBanner({super.key});

  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner> {
  /// Whether the banner content should be in the widget tree at all.
  /// Starts false so the text is never findable in the online-initial state.
  /// Becomes true on first offline/restored event, and stays true thereafter
  /// to allow the slide-out animation to play before we hide it again.
  bool _shouldRender = false;
  bool _visible = false;
  bool _isRestored = false;

  @override
  void initState() {
    super.initState();
    final state = context.read<ConnectivityCubit>().state;
    if (state is ConnectivityOffline) {
      _shouldRender = true;
      _visible = true;
    }
  }

  void _handleState(ConnectivityState state) {
    if (state is ConnectivityOffline) {
      setState(() {
        _shouldRender = true;
        _visible = true;
        _isRestored = false;
      });
    } else if (state is ConnectivityRestored) {
      setState(() {
        _shouldRender = true;
        _visible = true;
        _isRestored = true;
      });
    } else if (state is ConnectivityOnline) {
      setState(() {
        _visible = false;
        _isRestored = false;
      });
      // Keep _shouldRender = true during the exit animation, then clear.
      Future.delayed(const Duration(milliseconds: 220), () {
        if (mounted) setState(() => _shouldRender = false);
      });
    }
  }

  void _dismiss() {
    setState(() => _visible = false);
    Future.delayed(const Duration(milliseconds: 220), () {
      if (mounted) setState(() => _shouldRender = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_shouldRender) return const SizedBox.shrink();

    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final enterMs = reduceMotion ? 150 : 220;
    final exitMs = reduceMotion ? 150 : 160;
    final duration = Duration(milliseconds: _visible ? enterMs : exitMs);

    return BlocListener<ConnectivityCubit, ConnectivityState>(
      listener: (_, state) => _handleState(state),
      child: AnimatedSlide(
        offset: _visible ? Offset.zero : const Offset(0, -1),
        duration: duration,
        curve: Curves.easeOut,
        child: AnimatedOpacity(
          opacity: _visible ? 1.0 : 0.0,
          duration: duration,
          curve: Curves.easeOut,
          child: _BannerContent(
            isRestored: _isRestored,
            onDismiss: _dismiss,
          ),
        ),
      ),
    );
  }
}

class _BannerContent extends StatelessWidget {
  final bool isRestored;
  final VoidCallback onDismiss;

  const _BannerContent({required this.isRestored, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    final bg = isRestored
        ? AppColors.success
        : const Color(0xFF1A1F2B);
    final icon = isRestored ? Icons.check_circle_outline : Icons.wifi_off;
    final label = isRestored ? 'Conectado' : 'Sin conexión a internet';

    return Material(
      color: Colors.transparent,
      child: Container(
        width: double.infinity,
        color: bg,
        child: SafeArea(
          bottom: false,
          child: SizedBox(
            height: 48,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Icon(icon, size: 16, color: Colors.white),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Semantics(
                    label: 'Cerrar aviso de sin conexión',
                    child: GestureDetector(
                      onTap: onDismiss,
                      behavior: HitTestBehavior.opaque,
                      child: const SizedBox(
                        width: 44,
                        height: 44,
                        child: Center(
                          child: Icon(Icons.close, size: 16, color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
