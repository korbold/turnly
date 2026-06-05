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
    public function record(Request $request, string $reservationId): JsonResponse
    {
        $data = $request->validate([
            'method'    => ['required', Rule::in(['transfer', 'card', 'cash'])],
            'reference' => ['nullable', 'string', 'max:100'],
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

        $reservation->update([
            'payment_status'    => 'paid',
            'payment_method'    => $data['method'],
            'payment_reference' => $data['reference'] ?? null,
            'paid_at'           => now(),
        ]);

        ReservationUpdated::dispatch($reservation->fresh(['service', 'client', 'tenant']));

        return (new ReservationResource($reservation->fresh([
            'service', 'client', 'clientResource', 'items', 'tenant',
        ])))->response();
    }
}
