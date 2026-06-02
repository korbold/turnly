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

    public function index(Request $request)
    {
        $query = ReservationModel::with(['clientResource', 'service', 'client']);

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

        $dto = new CreateReservationDTO(
            tenantId: app('current_tenant_id'),
            clientId: $request->client_id ?? $request->user()->id,
            clientResourceId: $request->client_resource_id,
            serviceId: $request->service_id,
            scheduledAt: $request->scheduled_at,
            createdBy: $request->user()->id,
            assignedTo: $request->assigned_to,
            notes: $request->notes,
            serviceVariantId: $request->service_variant_id,
        );

        $reservation = $this->createReservation->execute($dto);

        // Persist the chosen variant on the model. The domain DTO/entity
        // pipeline doesn't carry it yet; setting it directly on the
        // Eloquent model is the smallest change that keeps the existing
        // service_id-based flow intact while letting the BOM/consumption
        // engine pick up the right recipe on `complete`.
        if ($request->service_variant_id) {
            ReservationModel::where('id', $reservation->id)
                ->update(['service_variant_id' => $request->service_variant_id]);
        }

        // Fetch the model with relationships for the resource
        $model = ReservationModel::with(['clientResource', 'service', 'client'])->find($reservation->id);

        return (new ReservationResource($model))
            ->response()
            ->setStatusCode(201);
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
