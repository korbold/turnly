<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Reservation;

use App\Events\ReservationUpdated;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\ReservationResource;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Records the moment + method a customer paid for a reservation. Pago
 * runs on a separate track from the lifecycle status: a service can
 * complete unpaid (typical car-wash, customer pays at pickup) or be
 * paid upfront (spa prepay) — this endpoint just stamps the timestamp,
 * method, and an optional reference.
 *
 * Phase 1 supports a single full payment. Partial / split payments live
 * in a dedicated table (Phase 3).
 */
class ReservationPaymentController extends Controller
{
    public function __construct(
        private \App\Domain\Reservation\ReservationBillingResolver $billing,
    ) {}

    public function record(Request $request, string $reservationId): JsonResponse
    {
        $data = $request->validate([
            'method'    => ['required', Rule::in(['transfer', 'card', 'cash'])],
            'reference' => ['nullable', 'string', 'max:100'],
            // Bank slug — only meaningful when method = transfer. Kept
            // free-form so tenants can add regional banks without a
            // schema change.
            'bank'      => ['nullable', 'string', 'max:40'],
            // Fiscal data for the invoice, captured here just like check-in.
            // Optional: absent → keep whatever check-in captured (or emit as
            // CONSUMIDOR FINAL).
            'billing_profile_id' => ['nullable', 'uuid', 'exists:user_billing_profiles,id'],
            'billing'            => ['nullable', 'array'],
            'billing.doc_type'   => ['nullable', Rule::in(['ruc', 'cedula', 'passport', 'final_consumer'])],
            'billing.doc_number' => ['nullable', 'string', 'max:13'],
            'billing.legal_name' => ['nullable', 'string', 'max:255'],
            'billing.email'      => ['nullable', 'email', 'max:255'],
            'billing.address'    => ['nullable', 'string', 'max:500'],
            'billing.phone'      => ['nullable', 'string', 'max:30'],
        ]);

        $reservation = ReservationModel::with(['service', 'client', 'tenant'])
            ->findOrFail($reservationId);

        if ($reservation->payment_status === 'paid') {
            return response()->json([
                'error' => [
                    'code' => 'ALREADY_PAID',
                    'message' => 'Esta reserva ya está marcada como pagada.',
                ],
            ], 422);
        }

        $updates = [
            'payment_status'    => 'paid',
            'payment_method'    => $data['method'],
            'payment_reference' => $data['reference'] ?? null,
            'payment_bank'      => $data['method'] === 'transfer' ? ($data['bank'] ?? null) : null,
            'paid_at'           => now(),
        ];

        // Capture fiscal data supplied at payment (mirrors check-in). Only
        // overwrite the snapshot when real fiscal data is provided — otherwise
        // keep whatever check-in already captured.
        if ($this->billing->hasRealFiscalData($data)) {
            $updates['billing_snapshot'] = $this->billing->resolveSnapshot($data);
            if (empty($data['billing_profile_id'])) {
                $this->billing->rememberBillingProfile($reservation->client_id, $data['billing'] ?? []);
            }
        }

        $reservation->update($updates);

        // Payment locks the items but no longer triggers the SRI invoice.
        // Facturación is now a manual step: the invoice is emitted on demand
        // via ReservationController::invoice (the "Emitir factura" button in
        // the reservation detail panel). Do NOT auto-dispatch here.

        ReservationUpdated::dispatch($reservation->fresh(['service', 'client', 'tenant']));

        return (new ReservationResource($reservation->fresh([
            'service', 'client', 'clientResource', 'items', 'tenant',
        ])))->response();
    }
}
