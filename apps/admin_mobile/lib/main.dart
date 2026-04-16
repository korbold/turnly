import 'package:flutter/material.dart';

void main() {
  runApp(const TurnlyApp());
}

class TurnlyApp extends StatelessWidget {
  const TurnlyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Turnly Admin',
      home: Scaffold(body: Center(child: Text('Turnly Admin'))),
    );
  }
}
