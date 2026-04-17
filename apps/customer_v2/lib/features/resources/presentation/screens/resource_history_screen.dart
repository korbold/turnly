// lib/features/resources/presentation/screens/resource_history_screen.dart
import 'package:flutter/material.dart';

class ResourceHistoryScreen extends StatelessWidget {
  final String resourceId;
  final String label;

  const ResourceHistoryScreen({
    super.key,
    required this.resourceId,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text('Resource History: $label')),
    );
  }
}
