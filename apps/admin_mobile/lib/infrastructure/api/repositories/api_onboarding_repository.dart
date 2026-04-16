import '../../../domain/entities/tenant.dart';
import '../../../domain/repositories/onboarding_repository.dart';
import '../dio_client.dart';
import '../mappers/tenant_mapper.dart';

class ApiOnboardingRepository implements OnboardingRepository {
  final DioClient _client;

  ApiOnboardingRepository(this._client);

  @override
  Future<({String token, Tenant tenant})> register({
    required String businessName,
    required String ownerName,
    required String email,
    required String password,
  }) async {
    final response = await _client.dio.post('/onboarding/register', data: {
      'business_name': businessName,
      'owner_name': ownerName,
      'email': email,
      'password': password,
    });
    final data = response.data['data'] ?? response.data;
    return (
      token: data['token'] as String,
      tenant: mapTenant(data['tenant'] as Map<String, dynamic>),
    );
  }

  @override
  Future<void> verify(String code) async {
    await _client.dio.post('/onboarding/verify', data: {'code': code});
  }

  @override
  Future<bool> checkSlug(String slug) async {
    final response =
        await _client.dio.get('/onboarding/check-slug', queryParameters: {
      'slug': slug,
    });
    final data = response.data['data'] ?? response.data;
    return data['available'] as bool;
  }

  @override
  Future<void> setBusinessType(String type, bool createServices) async {
    await _client.dio.post('/onboarding/business-type', data: {
      'type': type,
      'create_services': createServices,
    });
  }
}
