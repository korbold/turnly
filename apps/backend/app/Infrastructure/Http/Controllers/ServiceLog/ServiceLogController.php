<?php

namespace App\Infrastructure\Http\Controllers\ServiceLog;

use App\Application\DTOs\ServiceLog\CreateServiceLogDTO;
use App\Application\UseCases\ServiceLog\CreateServiceLogUseCase;
use App\Application\UseCases\ServiceLog\GetDailyLogUseCase;
use App\Domain\Inventory\ConsumptionEngine;
use App\Domain\ServiceLog\Contracts\ServiceLogRepositoryInterface;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\ServiceLog\CreateServiceLogRequest;
use App\Infrastructure\Http\Resources\ServiceLogResource;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceLogController extends Controller
{
    public function __construct(
        private CreateServiceLogUseCase $createServiceLog,
        private GetDailyLogUseCase $getDailyLog,
        private ServiceLogRepositoryInterface $serviceLogRepository,
        private ConsumptionEngine $consumption,
    ) {}

    public function index(Request $request)
    {
        $query = ServiceLogModel::with(['clientResource', 'service', 'attendant']);

        if ($request->has('date')) {
            $query->whereDate('log_date', $request->date);
        } else {
            $query->whereDate('log_date', now()->toDateString());
        }

        $logs = $query->orderBy('started_at', 'desc')->paginate($request->get('per_page', 50));

        return ServiceLogResource::collection($logs);
    }

    public function store(CreateServiceLogRequest $request): JsonResponse
    {
        $dto = new CreateServiceLogDTO(
            tenantId: app('current_tenant_id'),
            clientResourceId: $request->client_resource_id,
            serviceId: $request->service_id,
            attendedBy: $request->attended_by,
            createdBy: $request->user()->id,
            priceCharged: $request->price_charged,
            paymentMethod: $request->payment_method,
            reservationId: $request->reservation_id,
            notes: $request->notes,
        );

        $serviceLog = $this->createServiceLog->execute($dto);

        // Variant id rides on the model rather than the DTO to keep the
        // existing service-log domain pipeline untouched.
        if ($request->service_variant_id) {
            ServiceLogModel::where('id', $serviceLog->id)
                ->update(['service_variant_id' => $request->service_variant_id]);
        }

        $model = ServiceLogModel::with(['clientResource', 'service', 'attendant'])->find($serviceLog->id);

        return (new ServiceLogResource($model))
            ->response()
            ->setStatusCode(201);
    }

    public function show(string $id): ServiceLogResource
    {
        $serviceLog = ServiceLogModel::with(['clientResource', 'service', 'attendant', 'reservation'])->findOrFail($id);
        return new ServiceLogResource($serviceLog);
    }

    public function update(Request $request, string $id): ServiceLogResource
    {
        $serviceLog = ServiceLogModel::findOrFail($id);

        $request->validate([
            'service_id' => 'nullable|uuid',
            'attended_by' => 'nullable|uuid',
            'price_charged' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|in:cash,card,transfer,other',
            'notes' => 'nullable|string|max:500',
        ]);

        $serviceLog->update($request->only([
            'service_id', 'attended_by', 'price_charged', 'payment_method', 'notes',
        ]));

        return new ServiceLogResource($serviceLog->load(['clientResource', 'service', 'attendant']));
    }

    public function destroy(string $id): JsonResponse
    {
        $serviceLog = ServiceLogModel::findOrFail($id);
        $serviceLog->delete();

        return response()->json(['data' => ['message' => 'Registro eliminado']], 200);
    }

    public function complete(string $id): JsonResponse
    {
        $this->serviceLogRepository->complete($id, new \DateTimeImmutable());

        // Apply BOM consumption now that the service is done. Engine is
        // idempotent so a manual retry won't double-debit stock.
        $log = ServiceLogModel::find($id);
        if ($log) {
            $this->consumption->applyForServiceLog($log);
        }

        return response()->json([
            'data' => ['message' => 'Service log completed'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $date = $request->get('date', now()->toDateString());
        $result = $this->getDailyLog->execute(app('current_tenant_id'), $date);

        return response()->json([
            'data' => $result['summary'],
            'meta' => [
                'tenant' => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }
}
