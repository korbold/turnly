// This is a basic Flutter widget test.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:washflow_mobile/main.dart';

void main() {
  testWidgets('WashFlow app smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: WashFlowApp()));
  });
}
