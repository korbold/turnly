<?php

namespace App\Infrastructure\Http\Controllers\Reservation;

use App\Application\DTOs\Reservation\AvailableSlotsQueryDTO;
use App\Application\DTOs\Reservation\CreateReservationDTO;
use App\Application\Services\PlanLimitsService;
use App\Application\UseCases\Reservation\CancelReservationUseCase;
use App\Application\UseCases\Reservation\CompleteWashUseCase;
use App\Application\UseCases\Reservation\ConfirmReservationUseCase;
use App\Application\UseCases\Reservation\CreateReservationUseCase;
use App\Application\UseCases\Reservation\GetAvailableSlotsUseCase;
use App\Application\UseCases\Reservation\NoShowReservationUseCase;
use App\Application\UseCases\Reservation\StartWashUseCase;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Reservation\CancelReservationRequest;
use App\Infrastructure\Http\Requests\Reservation\CreateReservationRequest;
use App\Infrastructure\Http\Resources\ReservationResource;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReservationController extends Controller
{
    public function __construct(
        private CreateReservationUseCase $createReservation,
        private ConfirmReservationUseCase $confirmReservation,
        private CancelReservationUseCase $cancelReservation,
        private StartWashUseCase $startWash,
        private CompleteWashUseCase $completeWash,
        private GetAvailableSlotsUseCase $getAvailableSlots,
        private NoShowReservationUseCase $noShowReservation,
        private PlanLimitsService $planLimits,
    ) {}

    /**
     * Client-facing: returns all reservations for the authenticated user across all tenants.
     */
    public function myReservations(Request $request)
    {
        $query = ReservationModel::withoutGlobalScope(\App\Infrastructure\Persistence\Scopes\TenantScope::class)
            ->with(['clientResource', 'service', 'tenant'])
            ->where('client_id', $request->user()->id);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $sort = in_array($request->status, ['completed', 'cancelled', 'no_show']) ? 'desc' : 'asc';
        $reservations = $query->orderBy('scheduled_at', $sort)->paginate(30);

        return ReservationResource::collection($reservations);
    }

    public function myReservationShow(Request $request, string $id)
    {
        $reservation = ReservationModel::withoutGlobalScope(\App\Infrastructure\Persistence\Scopes\TenantScope::class)
            ->with(['clientResource', 'service', 'client', 'assignedEmployee', 'tenant'])
            ->where('client_id', $request->user()->id)
            ->findOrFail($id);

        return new ReservationResource($reservation);
    }

    public function myReservationCancel(Request $request, string $id): JsonResponse
    {
        $reservation = ReservationModel::withoutGlobalScope(\App\Infrastructure\Persistence\Scopes\TenantScope::class)
            ->where('client_id', $request->user()->id)
            ->findOrFail($id);

        $this->cancelReservation->execute($reservation->id, $request->reason);

        return response()->json([
            'data' => ['message' => 'Reservation cancelled'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    /**
     * Customer-initiated reschedule. Moves the reservation to a new
     * `scheduled_at` and recomputes `estimated_end` from the existing
     * items[] sum. Same window as cancel: blocked once we're inside the
     * tenant's `cancellation_hours` cooldown.
     */
    public function myReservationReschedule(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
        ]);

        $reservation = ReservationModel::withoutGlobalScope(\App\Infrastructure\Persistence\Scopes\TenantScope::class)
            ->where('client_id', $request->user()->id)
            ->with(['items', 'tenant', 'service'])
            ->findOrFail($id);

        if (!in_array($reservation->status, ['pending', 'confirmed'], true)) {
            return response()->json([
                'error' => ['code' => 'INVALID_STATUS', 'message' => 'Solo puedes reagendar reservas pendientes o confirmadas.'],
            ], 422);
        }

        if (!empty($reservation->client_rescheduled_at)) {
            return response()->json([
                'error' => ['code' => 'ALREADY_RESCHEDULED', 'message' => 'Solo puedes reagendar tu cita una vez. Contáctanos si necesitas otro cambio.'],
            ], 422);
        }

        $cancellationHours = $reservation->tenant?->settings['cancellation_hours'] ?? 1;
        $hoursUntil = now()->diffInHours(\Carbon\Carbon::parse($reservation->scheduled_at), false);
        if ($hoursUntil < $cancellationHours) {
            return response()->json([
                'error' => ['code' => 'COOLDOWN', 'message' => "Solo puedes reagendar hasta {$cancellationHours} hora(s) antes de tu cita."],
            ], 422);
        }

        // Sum durations off the persisted items so the new estimated_end
        // matches what the customer actually booked, not the legacy
        // single-service duration.
        $totalDurationMin = 0;
        foreach ($reservation->items as $it) {
            $variant = \App\Infrastructure\Persistence\Models\ServiceVariantModel::find($it->ref_id);
            $totalDurationMin += (int) (($variant?->duration_min ?? 30) * ($it->qty ?: 1));
        }
        if ($totalDurationMin <= 0) {
            $totalDurationMin = (int) ($reservation->service?->duration_minutes ?? 30);
        }

        $start = new \DateTimeImmutable($data['scheduled_at']);
        $end = $start->modify("+{$totalDurationMin} minutes");

        $reservation->update([
            'scheduled_at' => $start->format('Y-m-d H:i:s'),
            'estimated_end' => $end->format('Y-m-d H:i:s'),
            'client_rescheduled_at' => now(),
        ]);

        // Notify client + tenant admins so the agenda reflects the move.
        try {
            $fresh = ReservationModel::with(['service', 'tenant', 'client'])->find($reservation->id);
            if ($fresh) {
                \App\Events\ReservationUpdated::dispatch($fresh);
                $client = $fresh->client;
                if ($client) {
                    $client->notify(new \App\Infrastructure\Notifications\Notifications\ReservationModified($fresh));
                }
                $admins = $fresh->tenant
                    ?->users()
                    ->wherePivotIn('role', ['owner', 'tenant_admin', 'cashier'])
                    ->wherePivot('is_active', true)
                    ->get();
                if ($admins && $admins->isNotEmpty()) {
                    \Illuminate\Support\Facades\Notification::send($admins, new \App\Infrastructure\Notifications\Notifications\ReservationModified($fresh));
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to send reschedule notification', ['error' => $e->getMessage()]);
        }

        return response()->json([
            'data' => [
                'message' => 'Reservation rescheduled',
                'scheduled_at' => $reservation->scheduled_at,
                'estimated_end' => $reservation->estimated_end,
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function index(Request $request)
    {
        $query = ReservationModel::with(['clientResource', 'service', 'client', 'items']);

        if ($request->has('date_from') && $request->has('date_to')) {
            $query->whereDate('scheduled_at', '>=', $request->date_from)
                  ->whereDate('scheduled_at', '<=', $request->date_to);
        } elseif ($request->has('date')) {
            $query->whereDate('scheduled_at', $request->date);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('service_id')) {
            $query->where('service_id', $request->service_id);
        }

        $perPage = $request->has('date_from') ? 500 : (int) $request->get('per_page', 15);
        $reservations = $query->orderBy('scheduled_at')->paginate($perPage);

        return ReservationResource::collection($reservations);
    }

    public function store(CreateReservationRequest $request): JsonResponse
    {
        if (!$this->planLimits->canCreateReservation(app('current_tenant_id'))) {
            return response()->json([
                'error' => ['code' => 'PLAN_LIMIT', 'message' => 'Límite de reservas mensuales alcanzado. Actualiza tu plan.'],
            ], 403);
        }

        $tenantId = app('current_tenant_id');

        // Resolve items[] (multi-service) to (totalDuration, firstService,
        // firstVariant, normalized lines) so the existing DTO/Use Case keeps
        // serving the legacy single-service shape while we persist the
        // polymorphic items afterwards.
        [$resolvedItems, $totalDurationMin, $firstServiceId, $firstVariantId] =
            $this->resolveItems($tenantId, $request);

        if ($resolvedItems === null) {
            return response()->json([
                'error' => ['code' => 'INVALID_ITEMS', 'message' => 'Items inválidos para este negocio.'],
            ], 422);
        }

        $serviceId = $request->service_id ?? $firstServiceId;
        $variantId = $request->service_variant_id ?? $firstVariantId;

        $dto = new CreateReservationDTO(
            tenantId: $tenantId,
            clientId: $request->client_id ?? $request->user()->id,
            clientResourceId: $request->client_resource_id,
            serviceId: $serviceId,
            scheduledAt: $request->scheduled_at,
            createdBy: $request->user()->id,
            assignedTo: $request->assigned_to,
            notes: $request->notes,
            serviceVariantId: $variantId,
        );

        $reservation = $this->createReservation->execute($dto);

        // Persist variant_id + items in a follow-up step so the domain
        // pipeline above doesn't have to learn about polymorphic items.
        \Illuminate\Support\Facades\DB::transaction(function () use ($reservation, $variantId, $resolvedItems, $tenantId, $totalDurationMin, $request) {
            if ($variantId) {
                ReservationModel::where('id', $reservation->id)
                    ->update(['service_variant_id' => $variantId]);
            }

            if (!empty($resolvedItems)) {
                $sort = 0;
                foreach ($resolvedItems as $it) {
                    \App\Infrastructure\Persistence\Models\ReservationItemModel::create([
                        'tenant_id'      => $tenantId,
                        'reservation_id' => $reservation->id,
                        'item_type'      => 'service_variant',
                        'ref_id'         => $it['variant_id'],
                        'label'          => $it['label'],
                        'qty'            => $it['qty'],
                        'unit_price'     => $it['price'],
                        'line_total'     => $it['price'] * $it['qty'],
                        'sort_order'     => $sort++,
                    ]);
                }

                // Stretch estimated_end so multi-service reservations
                // actually block the right amount of time on the schedule.
                $start = new \DateTimeImmutable($request->scheduled_at);
                ReservationModel::where('id', $reservation->id)->update([
                    'estimated_end' => $start->modify("+{$totalDurationMin} minutes")->format('Y-m-d H:i:s'),
                ]);
            }
        });

        $model = ReservationModel::with(['clientResource', 'service', 'client'])->find($reservation->id);

        return (new ReservationResource($model))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Normalize the multi-service items[] payload (or the legacy
     * service_id / service_variant_id shape) into an array of variant
     * rows + total duration + first identifiers. Returns [null, ...]
     * when any variant is from another tenant.
     */
    private function resolveItems(string $tenantId, CreateReservationRequest $request): array
    {
        $tenantSlot = (int) (\App\Infrastructure\Persistence\Models\TenantModel::find($tenantId)?->settings['slot_duration_minutes'] ?? 30);

        if (!empty($request->items)) {
            $variantIds = collect($request->items)->pluck('service_variant_id')->all();
            $variants = \App\Infrastructure\Persistence\Models\ServiceVariantModel::withoutGlobalScopes()
                ->whereIn('id', $variantIds)
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->with('service')
                ->get()
                ->keyBy('id');

            $rows = [];
            $total = 0;
            $firstService = null;
            $firstVariant = null;

            foreach ($request->items as $row) {
                $variant = $variants->get($row['service_variant_id']);
                if (!$variant) return [null, 0, null, null];
                $qty = (int) ($row['qty'] ?? 1);
                $duration = max(1, (int) $variant->duration_min) * $qty;
                $total += $duration;
                $firstService = $firstService ?? $variant->service_id;
                $firstVariant = $firstVariant ?? $variant->id;
                $rows[] = [
                    'variant_id'   => $variant->id,
                    'service_id'   => $variant->service_id,
                    'label'        => ($variant->service?->name ?? 'Servicio') . ' · ' . $variant->label,
                    'qty'          => $qty,
                    'price'        => (float) $variant->price,
                    'duration_min' => $duration,
                ];
            }

            return [$rows, $total, $firstService, $firstVariant];
        }

        // Legacy single-service path: optionally synthesize one item from
        // the explicit variant_id so multi-line + single-line callers end
        // up with the same shape downstream.
        if ($request->service_variant_id) {
            $variant = \App\Infrastructure\Persistence\Models\ServiceVariantModel::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->where('id', $request->service_variant_id)
                ->with('service')
                ->first();
            if (!$variant) return [null, 0, null, null];
            $rows = [[
                'variant_id'   => $variant->id,
                'service_id'   => $variant->service_id,
                'label'        => ($variant->service?->name ?? 'Servicio') . ' · ' . $variant->label,
                'qty'          => 1,
                'price'        => (float) $variant->price,
                'duration_min' => (int) $variant->duration_min,
            ]];
            return [$rows, (int) $variant->duration_min, $variant->service_id, $variant->id];
        }

        // No variant info: rely on legacy service_id only, skip items
        // insertion entirely so we don't violate FKs.
        return [[], $tenantSlot, $request->service_id, null];
    }

    public function show(string $id): ReservationResource
    {
        $reservation = ReservationModel::with(['clientResource', 'service', 'client', 'assignedEmployee'])->findOrFail($id);
        return new ReservationResource($reservation);
    }

    public function confirm(string $id): JsonResponse
    {
        $this->confirmReservation->execute($id);
        return response()->json([
            'data' => ['message' => 'Reservation confirmed'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function start(string $id): JsonResponse
    {
        $this->startWash->execute($id);
        return response()->json([
            'data' => ['message' => 'Wash started'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function complete(string $id): JsonResponse
    {
        $this->completeWash->execute($id);
        return response()->json([
            'data' => ['message' => 'Wash completed'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function cancel(CancelReservationRequest $request, string $id): JsonResponse
    {
        $this->cancelReservation->execute($id, $request->reason);
        return response()->json([
            'data' => ['message' => 'Reservation cancelled'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    /**
     * Tenant-staff reschedule. Same effects as myReservationReschedule
     * but skips the client_id ownership check (staff manages any
     * reservation in their tenant) and the cooldown — operators need to
     * shuffle things around right up to the slot.
     */
    public function reschedule(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
        ]);

        $reservation = ReservationModel::with(['items', 'tenant', 'service'])
            ->findOrFail($id);

        if (!in_array($reservation->status, ['pending', 'confirmed'], true)) {
            return response()->json([
                'error' => ['code' => 'INVALID_STATUS', 'message' => 'Solo puedes reagendar reservas pendientes o confirmadas.'],
            ], 422);
        }

        $totalDurationMin = 0;
        foreach ($reservation->items as $it) {
            $variant = \App\Infrastructure\Persistence\Models\ServiceVariantModel::find($it->ref_id);
            $totalDurationMin += (int) (($variant?->duration_min ?? 30) * ($it->qty ?: 1));
        }
        if ($totalDurationMin <= 0) {
            $totalDurationMin = (int) ($reservation->service?->duration_minutes ?? 30);
        }

        $start = new \DateTimeImmutable($data['scheduled_at']);
        $end = $start->modify("+{$totalDurationMin} minutes");

        $reservation->update([
            'scheduled_at' => $start->format('Y-m-d H:i:s'),
            'estimated_end' => $end->format('Y-m-d H:i:s'),
        ]);

        try {
            $fresh = ReservationModel::with(['service', 'tenant', 'client'])->find($reservation->id);
            if ($fresh) {
                \App\Events\ReservationUpdated::dispatch($fresh);
                $client = $fresh->client;
                if ($client) {
                    $client->notify(new \App\Infrastructure\Notifications\Notifications\ReservationModified($fresh));
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to send reschedule notification', ['error' => $e->getMessage()]);
        }

        return response()->json([
            'data' => [
                'message' => 'Reservation rescheduled',
                'scheduled_at' => $reservation->scheduled_at,
                'estimated_end' => $reservation->estimated_end,
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function noShow(string $id): JsonResponse
    {
        $this->noShowReservation->execute($id);
        return response()->json([
            'data' => ['message' => 'Reservation marked as no-show'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function availableSlots(Request $request): JsonResponse
    {
        $request->validate([
            'date' => 'required|date',
            'service_id' => 'required|uuid',
        ]);

        $dto = new AvailableSlotsQueryDTO(
            tenantId: app('current_tenant_id'),
            date: $request->date,
            serviceId: $request->service_id,
        );

        $slots = $this->getAvailableSlots->execute($dto);

        return response()->json([
            'data' => $slots,
            'meta' => [
                'tenant' => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }
}
