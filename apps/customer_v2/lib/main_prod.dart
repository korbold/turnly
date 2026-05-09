// Entry point for prod flavor.
// Run: fvm flutter run --flavor prod -t lib/main_prod.dart --release
import 'main.dart' as runner;

Future<void> main() => runner.bootstrap(env: 'prod');
