import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:customer_v2/main.dart';
import 'package:customer_v2/features/favorites/data/favorites_storage.dart';

void main() {
  testWidgets('App renders smoke test', (WidgetTester tester) async {
    await Hive.initFlutter();
    final storage = FavoritesStorage();
    await storage.init();
    await tester.pumpWidget(TurnlyApp(favoritesStorage: storage));
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
