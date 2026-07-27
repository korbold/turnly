// lib/features/business/presentation/widgets/hero_header.dart
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../../shared/widgets/glass_surface.dart';
import '../../../../shared/widgets/logo_gradient_background.dart';
import '../../../explore/domain/entities/business.dart';

class HeroHeader extends StatelessWidget {
  final Business business;
  final TenantTheme tenantTheme;
  final VoidCallback? onBack;

  const HeroHeader({
    super.key,
    required this.business,
    required this.tenantTheme,
    this.onBack,
  });

  static const _typeLabels = <String, String>{
    'car_wash': 'Car Wash',
    'barbershop': 'Barberia',
    'spa': 'Spa',
    'gym': 'Gym',
    'medical': 'Medico',
  };

  static const _typeEmojis = <String, String>{
    'car_wash': '🚗',
    'barbershop': '💈',
    'spa': '🧖',
    'gym': '💪',
    'medical': '🏥',
  };

  @override
  Widget build(BuildContext context) {
    final typeLabel =
        _typeLabels[business.businessType] ?? business.businessType ?? '';
    final typeEmoji = _typeEmojis[business.businessType] ?? '🏪';
    final hasLogo = business.logoUrl != null && business.logoUrl!.isNotEmpty;

    return LogoGradientBackground(
      logoUrl: business.logoUrl,
      fallback: [tenantTheme.primary, tenantTheme.accent],
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Back button (glass)
              Align(
                alignment: Alignment.centerLeft,
                child: GestureDetector(
                  onTap: onBack ?? () => Navigator.of(context).pop(),
                  child: const GlassSurface(
                    radius: 12,
                    blur: 8,
                    child: SizedBox(
                      width: 40,
                      height: 40,
                      child: Icon(
                        Icons.arrow_back_ios_new_rounded,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),

              // Logo card that adapts to the logo's aspect ratio
              _LogoBanner(
                logoUrl: hasLogo ? business.logoUrl : null,
                emoji: typeEmoji,
              ).animate().fadeIn(duration: 500.ms, delay: 150.ms).slideY(
                    begin: 0.08,
                    end: 0,
                    duration: 500.ms,
                    delay: 150.ms,
                    curve: Curves.easeOut,
                  ),
              const SizedBox(height: 14),

              // Business name (centered, light over the gradient)
              Text(
                business.name,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  height: 1.2,
                  shadows: [
                    Shadow(
                      color: Colors.black.withValues(alpha: 0.35),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ).animate().fadeIn(duration: 400.ms, delay: 100.ms),
              const SizedBox(height: 10),

              // Type badge (glass pill)
              if (typeLabel.isNotEmpty)
                Center(
                  child: _GlassChip(
                    child: Text(
                      typeLabel,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
                ),

              const SizedBox(height: 16),

              // Stats row (glass chips)
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  _StatChip(
                    icon: Icons.miscellaneous_services_rounded,
                    value: '${business.services.length}',
                    label: 'Servicios',
                  ),
                  _StatChip(
                    icon: Icons.timer_outlined,
                    value: '${business.slotDuration}',
                    label: 'min',
                  ),
                  if (business.address != null &&
                      business.address!.isNotEmpty)
                    _StatChip(
                      icon: Icons.location_on_outlined,
                      value: '',
                      label: business.address!.length > 15
                          ? '${business.address!.substring(0, 15)}...'
                          : business.address!,
                    ),
                ],
              ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
            ],
          ),
        ),
      ),
    );
  }
}

/// Frosted-glass pill used for the type badge and stat chips over the
/// dark logo gradient. Thin wrapper over the shared [GlassSurface].
class _GlassChip extends StatelessWidget {
  final Widget child;
  const _GlassChip({required this.child});

  @override
  Widget build(BuildContext context) {
    return GlassSurface(
      radius: 20,
      blur: 10,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      child: child,
    );
  }
}

/// White logo card whose shape follows the logo's own aspect ratio:
/// a wide horizontal logo yields a wide short card, a square logo a
/// square card. The ratio is clamped so extreme logos stay tidy, and
/// the card is bounded by a max/min height so it never dominates the
/// header. Falls back to the business-type emoji when there's no logo.
class _LogoBanner extends StatefulWidget {
  final String? logoUrl;
  final String emoji;

  const _LogoBanner({required this.logoUrl, required this.emoji});

  @override
  State<_LogoBanner> createState() => _LogoBannerState();
}

class _LogoBannerState extends State<_LogoBanner> {
  ImageStream? _stream;
  ImageStreamListener? _listener;
  double? _ratio;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void didUpdateWidget(covariant _LogoBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.logoUrl != widget.logoUrl) {
      _ratio = null;
      _resolve();
    }
  }

  void _resolve() {
    _detach();
    final url = widget.logoUrl;
    if (url == null || url.isEmpty) return;
    final provider = CachedNetworkImageProvider(url);
    final stream = provider.resolve(ImageConfiguration.empty);
    final listener = ImageStreamListener((info, _) {
      final r = info.image.width / info.image.height;
      if (mounted && r.isFinite && r > 0) setState(() => _ratio = r);
    }, onError: (_, __) {});
    stream.addListener(listener);
    _stream = stream;
    _listener = listener;
  }

  void _detach() {
    if (_stream != null && _listener != null) {
      _stream!.removeListener(_listener!);
    }
    _stream = null;
    _listener = null;
  }

  @override
  void dispose() {
    _detach();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasLogo = widget.logoUrl != null && widget.logoUrl!.isNotEmpty;
    // Default to a wide banner until the real ratio loads; clamp so a
    // very wide or very tall logo can't distort the header.
    final ratio = (_ratio ?? 2.4).clamp(1.0, 3.4);

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          maxWidth: double.infinity,
          minHeight: 88,
          maxHeight: 128,
        ),
        child: AspectRatio(
          aspectRatio: ratio,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: hasLogo
                ? CachedNetworkImage(
                    imageUrl: widget.logoUrl!,
                    fit: BoxFit.contain,
                    errorWidget: (_, __, ___) => Center(
                      child: Text(widget.emoji,
                          style: const TextStyle(fontSize: 48)),
                    ),
                  )
                : Center(
                    child:
                        Text(widget.emoji, style: const TextStyle(fontSize: 48)),
                  ),
          ),
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _StatChip({
    required this.icon,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return _GlassChip(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.white),
          const SizedBox(width: 4),
          if (value.isNotEmpty) ...[
            Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }
}
