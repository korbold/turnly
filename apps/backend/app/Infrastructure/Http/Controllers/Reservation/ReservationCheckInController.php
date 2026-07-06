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
    public function __construct(
        private ConsumptionEngine $consumption,
        private \App\Domain\Reservation\ReservationBillingResolver $billing,
    ) {}

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

        $snapshot = $this->billing->resolveSnapshot($data);

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
                $this->billing->rememberBillingProfile($reservation->client_id, $data['billing'] ?? []);
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

        $snapshot = $this->billing->resolveSnapshot($data);
        $reservation->update(['billing_snapshot' => $snapshot]);

        return response()->json([
            'data' => ['billing_snapshot' => $snapshot],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

}
