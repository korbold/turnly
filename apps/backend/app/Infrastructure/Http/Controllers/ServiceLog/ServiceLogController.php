<?php

namespace App\Infrastructure\Http\Controllers\ServiceLog;

use App\Application\DTOs\ServiceLog\CreateServiceLogDTO;
use App\Application\UseCases\ServiceLog\CreateServiceLogUseCase;
use App\Application\UseCases\ServiceLog\GetDailyLogUseCase;
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

    public function complete(string $id): JsonResponse
    {
        $this->serviceLogRepository->complete($id, new \DateTimeImmutable());

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
