// Entry point for dev flavor.
// Run: fvm flutter run --flavor dev -t lib/main_dev.dart
import 'main.dart' as runner;

Future<void> main() => runner.bootstrap(env: 'dev');
