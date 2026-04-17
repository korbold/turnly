// lib/features/business/presentation/screens/business_detail_screen.dart
import 'package:flutter/material.dart';

class BusinessDetailScreen extends StatelessWidget {
  final String slug;

  const BusinessDetailScreen({super.key, required this.slug});

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: Center(child: Text('Business Detail: $slug')));
  }
}
