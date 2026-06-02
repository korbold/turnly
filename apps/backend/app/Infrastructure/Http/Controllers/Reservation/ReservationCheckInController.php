<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Reservation;

use App\Domain\Inventory\ConsumptionEngine;
use App\Domain\Reservation\Enums\ReservationStatus;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\ReservationResource;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        DB::transaction(function () use ($reservation, $snapshot) {
            $reservation->update([
                'status'           => ReservationStatus::CheckedIn->value,
                'checked_in_at'    => now(),
                'billing_snapshot' => $snapshot,
            ]);

            // Hold BOM stock now that the customer is in the building.
            // Reservation items are already in place from booking or
            // counter edits made just before check-in.
            $this->consumption->reserveForReservation($reservation->fresh('items'));
        });

        $fresh = ReservationModel::with(['service', 'client', 'clientResource', 'items'])
            ->findOrFail($reservation->id);

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
