import '../entities/tenant.dart';

abstract class OnboardingRepository {
  Future<({String token, Tenant tenant})> register({
    required String businessName,
    required String ownerName,
    required String email,
    required String password,
  });
  Future<void> verify(String code);
  Future<bool> checkSlug(String slug);
  Future<void> setBusinessType(String type, bool createServices);
}
