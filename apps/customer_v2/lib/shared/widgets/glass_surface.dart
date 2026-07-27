// lib/shared/widgets/glass_surface.dart
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

/// A single, reusable frosted-glass surface — the one place the app's
/// liquid-glass look is defined (blur, tint, hairline border, radius and
/// an optional specular top highlight).
///
/// Glass only reads as glass when there is something colorful behind it to
/// refract; place it over a gradient / ambient backdrop, not flat white.
///
/// Presentational only — wrap it in a GestureDetector/InkWell for taps.
class GlassSurface extends StatelessWidget {
  final Widget child;

  /// Corner radius of the surface.
  final double radius;

  /// Backdrop blur strength.
  final double blur;

  /// Base tint painted over the blur. Defaults to white for light glass;
  /// pass a dark color for dark glass.
  final Color tint;

  /// Opacity of [tint].
  final double tintOpacity;

  /// Opacity of the hairline border (uses [tint]'s hue).
  final double borderOpacity;

  /// Inner padding around [child]. Null = no padding.
  final EdgeInsetsGeometry? padding;

  /// Whether to paint a soft top-to-bottom sheen for a glassier edge.
  final bool highlight;

  const GlassSurface({
    super.key,
    required this.child,
    this.radius = 20,
    this.blur = 12,
    this.tint = Colors.white,
    this.tintOpacity = 0.16,
    this.borderOpacity = 0.22,
    this.padding,
    this.highlight = true,
  });

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(radius);
    return ClipRRect(
      borderRadius: borderRadius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: DecoratedBox(
          decoration: BoxDecoration(
            // Sheen baked into the background so it never washes the child:
            // slightly brighter tint at the top fading to the base tint.
            color: highlight ? null : tint.withValues(alpha: tintOpacity),
            gradient: highlight
                ? LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      tint.withValues(
                          alpha: (tintOpacity + 0.14).clamp(0.0, 1.0)),
                      tint.withValues(alpha: tintOpacity),
                    ],
                  )
                : null,
            borderRadius: borderRadius,
            border: Border.all(color: tint.withValues(alpha: borderOpacity)),
          ),
          child: padding != null
              ? Padding(padding: padding!, child: child)
              : child,
        ),
      ),
    );
  }
}
