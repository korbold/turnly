// lib/shared/widgets/logo_gradient_background.dart
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:palette_generator/palette_generator.dart';

/// A dark, dramatic background whose colors are extracted from a business
/// logo and animated in a slow flowing loop (the "waving flag" feel).
///
/// The palette is pulled once per logo URL with [PaletteGenerator] and
/// cached process-wide, so the explore list can reuse it across cards
/// without re-decoding. While the palette loads (or if it can't be read)
/// the [fallback] colors are used. A subtle dark overlay is layered on top
/// so light foreground content stays legible.
class LogoGradientBackground extends StatefulWidget {
  final String? logoUrl;
  final List<Color> fallback;
  final Widget child;
  final bool animate;
  final BorderRadius? borderRadius;

  const LogoGradientBackground({
    super.key,
    required this.child,
    required this.fallback,
    this.logoUrl,
    this.animate = true,
    this.borderRadius,
  });

  /// Process-wide palette cache keyed by logo URL.
  static final Map<String, List<Color>> _cache = {};

  @override
  State<LogoGradientBackground> createState() => _LogoGradientBackgroundState();
}

class _LogoGradientBackgroundState extends State<LogoGradientBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ac;
  List<Color>? _colors;

  @override
  void initState() {
    super.initState();
    _ac = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    );
    if (widget.animate) _ac.repeat(reverse: true);
    _loadPalette();
  }

  @override
  void didUpdateWidget(covariant LogoGradientBackground oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.logoUrl != widget.logoUrl) {
      _colors = null;
      _loadPalette();
    }
  }

  Future<void> _loadPalette() async {
    final url = widget.logoUrl;
    if (url == null || url.isEmpty) return;
    final cached = LogoGradientBackground._cache[url];
    if (cached != null) {
      _colors = cached;
      return;
    }
    try {
      final palette = await PaletteGenerator.fromImageProvider(
        CachedNetworkImageProvider(url),
        size: const Size(120, 120),
        maximumColorCount: 12,
      );
      final cols = _extract(palette);
      LogoGradientBackground._cache[url] = cols;
      if (mounted) setState(() => _colors = cols);
    } catch (_) {
      // keep fallback
    }
  }

  /// Pick up to 3 distinct, saturated colors from the palette and darken
  /// them toward black for the dramatic look.
  List<Color> _extract(PaletteGenerator p) {
    final candidates = <Color?>[
      p.darkVibrantColor?.color,
      p.vibrantColor?.color,
      p.dominantColor?.color,
      p.darkMutedColor?.color,
      p.mutedColor?.color,
      p.lightVibrantColor?.color,
    ];
    final seen = <int>{};
    final picked = <Color>[];
    for (final c in candidates) {
      if (c == null) continue;
      if (seen.add(c.toARGB32())) picked.add(_darken(c));
      if (picked.length == 3) break;
    }
    if (picked.length < 2) return widget.fallback.map(_darken).toList();
    return picked;
  }

  Color _darken(Color c) => Color.lerp(c, Colors.black, 0.28)!;

  @override
  void dispose() {
    _ac.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = (_colors != null && _colors!.length >= 2)
        ? _colors!
        : widget.fallback.map(_darken).toList();
    final colors = base.length >= 2 ? base : [base.first, base.first];

    return ClipRRect(
      borderRadius: widget.borderRadius ?? BorderRadius.zero,
      child: AnimatedBuilder(
        animation: _ac,
        builder: (context, child) {
          final t = Curves.easeInOut.transform(_ac.value);
          final begin = Alignment(_lerp(-1.0, 1.0, t), -1.0);
          final end = Alignment(_lerp(1.0, -1.0, t), 1.0);
          return DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: begin,
                end: end,
                colors: colors,
              ),
            ),
            child: child,
          );
        },
        // Dark legibility overlay + content sit above the animated gradient.
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withValues(alpha: 0.12),
                Colors.black.withValues(alpha: 0.42),
              ],
            ),
          ),
          child: widget.child,
        ),
      ),
    );
  }

  double _lerp(double a, double b, double t) => a + (b - a) * t;
}
