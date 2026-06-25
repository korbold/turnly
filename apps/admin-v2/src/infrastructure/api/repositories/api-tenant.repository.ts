import type { TenantRepository } from '@/domain/repositories/tenant.repository';
import type {
  TenantSettings,
  TenantImage,
  BillingProfile,
  BillingProfileInput,
  SriLookupResult,
  TaxIdType,
} from '@/domain/entities/tenant';
import api from '../client';
import { mapTenantSettings, mapTenantImage } from '../mappers/tenant.mapper';

export class ApiTenantRepository implements TenantRepository {
  async getSettings(): Promise<TenantSettings> {
    const { data: res } = await api.get('/tenant/settings');
    return mapTenantSettings(res.data);
  }

  async updateSettings(settings: Partial<TenantSettings>): Promise<TenantSettings> {
    const body: Record<string, unknown> = {};
    if (settings.name !== undefined) body.name = settings.name;
    if (settings.description !== undefined) body.description = settings.description;
    if (settings.address !== undefined) body.address = settings.address;
    if (settings.phone !== undefined) body.phone = settings.phone;
    if (settings.logoUrl !== undefined) body.logo_url = settings.logoUrl;
    if (settings.coverUrl !== undefined) body.cover_url = settings.coverUrl;
    if (settings.themeColor !== undefined) body.brand_theme = settings.themeColor;
    if (settings.slotDuration !== undefined) body.slot_duration = settings.slotDuration;
    if (settings.cancellationHours !== undefined) body.cancellation_hours = settings.cancellationHours;
    if (settings.defaultTaxRate !== undefined) body.default_tax_rate = settings.defaultTaxRate;
    if (settings.paymentTiming !== undefined) body.payment_timing = settings.paymentTiming;
    if (settings.socialLinks !== undefined) body.social_links = settings.socialLinks;
    if (settings.customFields !== undefined) body.custom_fields = settings.customFields;
    if (settings.businessType !== undefined) body.business_type = settings.businessType;
    if (settings.permissions !== undefined) body.permissions = settings.permissions;
    if (settings.autoConfirmReservations !== undefined) {
      body.auto_confirm_reservations = settings.autoConfirmReservations;
    }
    if (settings.allowClientResourceSelection !== undefined) {
      body.allow_client_resource_selection = settings.allowClientResourceSelection;
    }
    if (settings.ivaMode !== undefined) {
      body.iva_mode = settings.ivaMode;
    }

    const { data: res } = await api.patch('/tenant/settings', body);
    return mapTenantSettings(res.data);
  }

  async getImages(): Promise<TenantImage[]> {
    const { data: res } = await api.get('/tenant/images');
    return (res.data as Record<string, unknown>[]).map(mapTenantImage);
  }

  async addImage(file: File): Promise<TenantImage> {
    const formData = new FormData();
    formData.append('image', file);

    const { data: res } = await api.post('/tenant/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return mapTenantImage(res.data);
  }

  async deleteImage(id: string): Promise<void> {
    await api.delete(`/tenant/images/${id}`);
  }

  async reorderImages(ids: string[]): Promise<void> {
    await api.post('/tenant/images/reorder', { ids });
  }

  async getBillingProfile(): Promise<BillingProfile> {
    const { data: res } = await api.get('/tenant/billing-profile');
    return mapBillingProfile(res.data);
  }

  async updateBillingProfile(input: BillingProfileInput): Promise<BillingProfile> {
    const { data: res } = await api.patch('/tenant/billing-profile', {
      tax_id_type: input.taxIdType,
      tax_id: input.taxId,
      legal_name: input.legalName,
      billing_email: input.billingEmail,
      billing_address: input.billingAddress,
      billing_phone: input.billingPhone ?? null,
    });
    return mapBillingProfile(res.data);
  }

  async lookupTaxId(type: TaxIdType, taxId: string): Promise<SriLookupResult> {
    const { data: res } = await api.get('/tenant/billing-profile/lookup', {
      params: { tax_id_type: type, tax_id: taxId },
    });
    const d = res.data;
    return {
      formatValid: Boolean(d.format_valid),
      lookup: d.lookup
        ? {
            razonSocial: d.lookup.razon_social,
            estado: d.lookup.estado,
            tipoIdentificacion: d.lookup.tipo_identificacion,
          }
        : null,
    };
  }
}

function mapBillingProfile(d: Record<string, unknown>): BillingProfile {
  return {
    taxIdType: (d.tax_id_type as BillingProfile['taxIdType']) ?? null,
    taxId: (d.tax_id as string | null) ?? null,
    legalName: (d.legal_name as string | null) ?? null,
    billingEmail: (d.billing_email as string | null) ?? null,
    billingAddress: (d.billing_address as string | null) ?? null,
    billingPhone: (d.billing_phone as string | null) ?? null,
    billingVerified: Boolean(d.billing_verified),
    billingVerifiedAt: d.billing_verified_at
      ? new Date(d.billing_verified_at as string)
      : null,
  };
}
