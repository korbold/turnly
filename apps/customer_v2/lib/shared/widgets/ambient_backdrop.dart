// lib/shared/widgets/ambient_backdrop.dart
import 'package:flutter/material.dart';

/// Soft, slowly-drifting color blobs painted behind a screen. This is the
/// backdrop that gives liquid-glass surfaces above it something to refract —
/// without it, frosted panels over a flat background just look gray.
///
/// Blobs are drawn with radial gradients (no BackdropFilter) so they're
/// cheap, and the whole animated layer is isolated in a RepaintBoundary.
class AmbientBackdrop extends StatefulWidget {
  final Widget child;
  final Color baseColor;
  final List<Color> colors;
  final bool animate;

  const AmbientBackdrop({
    super.key,
    required this.child,
    required this.baseColor,
    required this.colors,
    this.animate = true,
  });

  @override
  State<AmbientBackdrop> createState() => _AmbientBackdropState();
}

class _AmbientBackdropState extends State<AmbientBackdrop>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ac;

  @override
  void initState() {
    super.initState();
    _ac = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 14),
    );
    if (widget.animate) _ac.repeat(reverse: true);
  }

  @override
  void dispose() {
    _ac.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors.isNotEmpty
        ? widget.colors
        : [widget.baseColor, widget.baseColor];

    return Stack(
      children: [
        Positioned.fill(child: ColoredBox(color: widget.baseColor)),
        Positioned.fill(
          child: RepaintBoundary(
            child: AnimatedBuilder(
              animation: _ac,
              builder: (context, _) {
                final t = Curves.easeInOut.transform(_ac.value);
                return Stack(
                  children: [
                    _blob(
                      Alignment(_lerp(-1.1, -0.7, t), _lerp(-1.0, -0.75, t)),
                      340,
                      colors[0],
                    ),
                    _blob(
                      Alignment(_lerp(1.2, 0.8, t), _lerp(-0.4, -0.1, t)),
                      300,
                      colors[colors.length > 1 ? 1 : 0],
                    ),
                    _blob(
                      Alignment(_lerp(-0.9, -0.5, t), _lerp(0.9, 0.6, t)),
                      320,
                      colors[colors.length > 2 ? 2 : 0],
                    ),
                  ],
                );
              },
            ),
          ),
        ),
        widget.child,
      ],
    );
  }

  Widget _blob(Alignment alignment, double size, Color color) {
    return Align(
      alignment: alignment,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: 0.28),
              color.withValues(alpha: 0.0),
            ],
          ),
        ),
      ),
    );
  }

  double _lerp(double a, double b, double t) => a + (b - a) * t;
}
