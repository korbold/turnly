<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Reservation;

use App\Domain\Inventory\ConsumptionEngine;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Events\ReservationUpdated;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\ReservationResource;
use App\Infrastructure\Notifications\Notifications\ReservationCheckedIn;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * Transitions a reservation from `confirmed` to `checked_in`.
 *
 * Side-effects:
 *   - Captures a billing snapshot (resolved from a user_billing_profiles
 *     row when provided, or supplied inline by the cashier for walk-ins).
 *   - Reserves the BOM consumables in the inventory ledger so concurrent
 *     bookings can't claim the same units before this service runs.
 */
class ReservationCheckInController extends Controller
{
    public function __construct(private ConsumptionEngine $consumption) {}

    public function checkIn(Request $request, string $reservationId): JsonResponse
    {
        $reservation = ReservationModel::with('items')->findOrFail($reservationId);

        $current = ReservationStatus::from((string) $reservation->status);
        if (!$current->canTransitionTo(ReservationStatus::CheckedIn)) {
            return response()->json([
                'error' => ['code' => 'INVALID_TRANSITION', 'message' => 'No se puede hacer check-in en este estado.'],
            ], 422);
        }

        $data = $request->validate([
            'billing_profile_id' => ['nullable', 'uuid', 'exists:user_billing_profiles,id'],
            'billing'            => ['nullable', 'array'],
            'billing.doc_type'   => ['nullable', Rule::in(['ruc', 'cedula', 'passport', 'final_consumer'])],
            'billing.doc_number' => ['nullable', 'string', 'max:13'],
            'billing.legal_name' => ['nullable', 'string', 'max:255'],
            'billing.email'      => ['nullable', 'email', 'max:255'],
            'billing.address'    => ['nullable', 'string', 'max:500'],
            'billing.phone'      => ['nullable', 'string', 'max:30'],
        ]);

        $snapshot = $this->resolveSnapshot($data);

        DB::transaction(function () use ($reservation, $snapshot, $data) {
            $reservation->update([
                'status'           => ReservationStatus::CheckedIn->value,
                'checked_in_at'    => now(),
                'billing_snapshot' => $snapshot,
            ]);

            // Remember the fiscal data on the client so the next check-in
            // prefills it. Only when the cashier typed it inline (no saved
            // profile picked) and it's a real fiscal document — never the
            // CONSUMIDOR FINAL fallback.
            if (empty($data['billing_profile_id'])) {
                $this->rememberBillingProfile($reservation->client_id, $data['billing'] ?? []);
            }

            // Hold BOM stock now that the customer is in the building.
            // Reservation items are already in place from booking or
            // counter edits made just before check-in.
            $this->consumption->reserveForReservation($reservation->fresh('items'));
        });

        $fresh = ReservationModel::with(['service', 'client.defaultBillingProfile', 'clientResource', 'items', 'tenant'])
            ->findOrFail($reservation->id);

        ReservationUpdated::dispatch($fresh);

        // Let the customer know we received them. Doesn't block the
        // response if the FCM call fails downstream.
        try {
            $client = UserModel::find($fresh->client_id);
            if ($client) {
                $client->notify(new ReservationCheckedIn($fresh));
            }
        } catch (\Throwable $e) {
            Log::error('Failed to send reservation checked-in notification', ['error' => $e->getMessage()]);
        }

        return (new ReservationResource($fresh))->response();
    }

    public function updateBilling(Request $request, string $reservationId): JsonResponse
    {
        $reservation = ReservationModel::findOrFail($reservationId);

        $data = $request->validate([
            'billing_profile_id' => ['nullable', 'uuid', 'exists:user_billing_profiles,id'],
            'billing'            => ['nullable', 'array'],
            'billing.doc_type'   => ['nullable', Rule::in(['ruc', 'cedula', 'passport', 'final_consumer'])],
            'billing.doc_number' => ['nullable', 'string', 'max:13'],
            'billing.legal_name' => ['nullable', 'string', 'max:255'],
            'billing.email'      => ['nullable', 'email', 'max:255'],
            'billing.address'    => ['nullable', 'string', 'max:500'],
            'billing.phone'      => ['nullable', 'string', 'max:30'],
        ]);

        $snapshot = $this->resolveSnapshot($data);
        $reservation->update(['billing_snapshot' => $snapshot]);

        return response()->json([
            'data' => ['billing_snapshot' => $snapshot],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    /**
     * Upsert the inline billing data as the client's default billing
     * profile so future check-ins prefill it. No-op for CONSUMIDOR FINAL
     * or when the document is incomplete.
     */
    private function rememberBillingProfile(?string $clientId, array $billing): void
    {
        if (!$clientId) {
            return;
        }

        $docType = $billing['doc_type'] ?? null;
        $docNumber = trim((string) ($billing['doc_number'] ?? ''));
        $legalName = trim((string) ($billing['legal_name'] ?? ''));

        // Only persist real fiscal identities the customer can reuse.
        if (!in_array($docType, ['ruc', 'cedula', 'passport'], true)
            || $docNumber === ''
            || $legalName === '') {
            return;
        }

        // The new/updated profile becomes the client's default; clear the
        // flag on their other profiles first (matches store() semantics).
        UserBillingProfileModel::where('user_id', $clientId)->update(['is_default' => false]);

        UserBillingProfileModel::updateOrCreate(
            ['user_id' => $clientId, 'doc_type' => $docType, 'doc_number' => $docNumber],
            [
                'legal_name' => $legalName,
                // email column is NOT NULL; keep '' when the cashier left it
                // blank (they can complete it before the SRI XML is sent).
                'email'      => $billing['email'] ?? '',
                'address'    => $billing['address'] ?? null,
                'phone'      => $billing['phone'] ?? null,
                'is_default' => true,
            ],
        );
    }

    private function resolveSnapshot(array $data): array
    {
        if (!empty($data['billing_profile_id'])) {
            $profile = UserBillingProfileModel::find($data['billing_profile_id']);
            if ($profile) {
                return [
                    'doc_type'   => $profile->doc_type,
                    'doc_number' => $profile->doc_number,
                    'legal_name' => $profile->legal_name,
                    'email'      => $profile->email,
                    'address'    => $profile->address,
                    'phone'      => $profile->phone,
                    'source'     => 'profile',
                    'captured_at' => now()->toIso8601String(),
                ];
            }
        }

        $b = $data['billing'] ?? [];
        return [
            'doc_type'   => $b['doc_type']   ?? 'final_consumer',
            'doc_number' => $b['doc_number'] ?? '9999999999999',
            'legal_name' => $b['legal_name'] ?? 'CONSUMIDOR FINAL',
            'email'      => $b['email']      ?? null,
            'address'    => $b['address']    ?? null,
            'phone'      => $b['phone']      ?? null,
            'source'     => 'manual',
            'captured_at' => now()->toIso8601String(),
        ];
    }
}
