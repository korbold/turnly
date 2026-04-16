import '../../../domain/entities/tenant.dart';

Tenant mapTenant(Map<String, dynamic> json) {
  return Tenant(
    id: json['id'] as int,
    slug: json['slug'] as String,
    name: json['name'] as String,
    ownerName: json['owner_name'] as String,
    email: json['email'] as String,
    phone: json['phone'] as String?,
    city: json['city'] as String?,
    country: json['country'] as String? ?? '',
    plan: _parsePlan(json['plan'] as String? ?? 'trial'),
    status: _parseStatus(json['status'] as String? ?? 'pending'),
    trialEndsAt: json['trial_ends_at'] != null
        ? DateTime.parse(json['trial_ends_at'] as String)
        : null,
    onboardingStep: json['onboarding_step'] as int? ?? 0,
    activatedAt: json['activated_at'] != null
        ? DateTime.parse(json['activated_at'] as String)
        : null,
    createdAt: DateTime.parse(json['created_at'] as String),
  );
}

TenantPlan _parsePlan(String value) {
  switch (value) {
    case 'trial':
      return TenantPlan.trial;
    case 'basic':
      return TenantPlan.basic;
    case 'pro':
      return TenantPlan.pro;
    default:
      return TenantPlan.trial;
  }
}

TenantStatus _parseStatus(String value) {
  switch (value) {
    case 'pending':
      return TenantStatus.pending;
    case 'active':
      return TenantStatus.active;
    case 'suspended':
      return TenantStatus.suspended;
    case 'cancelled':
      return TenantStatus.cancelled;
    default:
      return TenantStatus.pending;
  }
}
