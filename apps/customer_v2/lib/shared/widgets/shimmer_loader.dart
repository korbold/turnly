// lib/shared/widgets/shimmer_loader.dart
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class ShimmerLoader extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const ShimmerLoader({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = 12,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey.shade200,
      highlightColor: Colors.grey.shade50,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }

  /// Card-shaped shimmer placeholder
  static Widget card({double height = 120}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ShimmerLoader(height: height, borderRadius: 16),
    );
  }

  /// List of shimmer cards
  static Widget list({int count = 3, double itemHeight = 120}) {
    return Column(
      children: List.generate(count, (_) => card(height: itemHeight)),
    );
  }
}
