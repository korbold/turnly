import 'package:customer_v2/features/auth/data/dtos/auth_dto.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('UserDto.fromJson', () {
    test('parses terms_accepted_at when present', () {
      final dto = UserDto.fromJson({
        'id': '1',
        'name': 'Ana',
        'email': 'ana@test.com',
        'email_verified': true,
        'terms_accepted_at': '2026-05-20T18:00:00Z',
      });
      expect(dto.termsAcceptedAt, isNotNull);
      expect(dto.toEntity().termsAcceptedAt, isNotNull);
    });

    test('parses null terms_accepted_at', () {
      final dto = UserDto.fromJson({
        'id': '1',
        'name': 'Ana',
        'email': 'ana@test.com',
        'email_verified': true,
        'terms_accepted_at': null,
      });
      expect(dto.termsAcceptedAt, isNull);
      expect(dto.toEntity().termsAcceptedAt, isNull);
    });

    test('absent terms_accepted_at key defaults to null', () {
      final dto = UserDto.fromJson({
        'id': '1',
        'name': 'Ana',
        'email': 'ana@test.com',
        'email_verified': true,
      });
      expect(dto.termsAcceptedAt, isNull);
    });

    test('round-trips through toJson/fromJson', () {
      final original = UserDto(
        id: '1',
        name: 'Ana',
        email: 'ana@test.com',
        emailVerified: true,
        termsAcceptedAt: DateTime.parse('2026-05-20T18:00:00.000Z'),
      );
      final roundTripped = UserDto.fromJson(original.toJson());
      expect(
        roundTripped.termsAcceptedAt?.toUtc().toIso8601String(),
        equals(original.termsAcceptedAt?.toUtc().toIso8601String()),
      );
    });
  });
}
