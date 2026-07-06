<?php

declare(strict_types=1);

namespace App\Domain\Reservation;

use App\Infrastructure\Persistence\Models\UserBillingProfileModel;

/**
 * Resolves the fiscal buyer data for a reservation invoice from either a saved
 * billing profile or the values a cashier typed inline, and remembers reusable
 * identities so the next visit prefills. Shared by check-in and payment capture
 * so both entry points behave identically.
 */
final class ReservationBillingResolver
{
    /**
     * Build the billing_snapshot stored on the reservation. Falls back to
     * CONSUMIDOR FINAL when no real fiscal document is supplied.
     *
     * @param array{billing_profile_id?: ?string, billing?: array<string, mixed>} $data
     * @return array<string, mixed>
     */
    public function resolveSnapshot(array $data): array
    {
        if (!empty($data['billing_profile_id'])) {
            $profile = UserBillingProfileModel::find($data['billing_profile_id']);
            if ($profile) {
                return [
                    'doc_type'    => $profile->doc_type,
                    'doc_number'  => $profile->doc_number,
                    'legal_name'  => $profile->legal_name,
                    'email'       => $profile->email,
                    'address'     => $profile->address,
                    'phone'       => $profile->phone,
                    'source'      => 'profile',
                    'captured_at' => now()->toIso8601String(),
                ];
            }
        }

        $b = $data['billing'] ?? [];
        return [
            'doc_type'    => $b['doc_type']   ?? 'final_consumer',
            'doc_number'  => $b['doc_number'] ?? '9999999999999',
            'legal_name'  => $b['legal_name'] ?? 'CONSUMIDOR FINAL',
            'email'       => $b['email']      ?? null,
            'address'     => $b['address']    ?? null,
            'phone'       => $b['phone']      ?? null,
            'source'      => 'manual',
            'captured_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Whether the request carries real fiscal data worth persisting to the
     * reservation (i.e. not the CONSUMIDOR FINAL fallback).
     *
     * @param array{billing_profile_id?: ?string, billing?: array<string, mixed>} $data
     */
    public function hasRealFiscalData(array $data): bool
    {
        if (!empty($data['billing_profile_id'])) {
            return true;
        }

        $docType = $data['billing']['doc_type'] ?? 'final_consumer';
        return in_array($docType, ['ruc', 'cedula', 'passport'], true);
    }

    /**
     * Upsert inline billing data as the client's default profile so future
     * check-ins / payments prefill it. No-op for CONSUMIDOR FINAL or when the
     * document is incomplete.
     *
     * @param array<string, mixed> $billing
     */
    public function rememberBillingProfile(?string $clientId, array $billing): void
    {
        if (!$clientId) {
            return;
        }

        $docType = $billing['doc_type'] ?? null;
        $docNumber = trim((string) ($billing['doc_number'] ?? ''));
        $legalName = trim((string) ($billing['legal_name'] ?? ''));

        if (!in_array($docType, ['ruc', 'cedula', 'passport'], true)
            || $docNumber === ''
            || $legalName === '') {
            return;
        }

        UserBillingProfileModel::where('user_id', $clientId)->update(['is_default' => false]);

        UserBillingProfileModel::updateOrCreate(
            ['user_id' => $clientId, 'doc_type' => $docType, 'doc_number' => $docNumber],
            [
                'legal_name' => $legalName,
                // email column is NOT NULL; keep '' when left blank.
                'email'      => $billing['email'] ?? '',
                'address'    => $billing['address'] ?? null,
                'phone'      => $billing['phone'] ?? null,
                'is_default' => true,
            ],
        );
    }
}
