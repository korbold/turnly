<?php

namespace App\Infrastructure\Http\Controllers\WashLog;

use App\Application\DTOs\WashLog\CreateWashLogDTO;
use App\Application\UseCases\WashLog\CreateWashLogUseCase;
use App\Application\UseCases\WashLog\GetDailyLogUseCase;
use App\Domain\WashLog\Contracts\WashLogRepositoryInterface;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\WashLog\CreateWashLogRequest;
use App\Infrastructure\Http\Resources\WashLogResource;
use App\Infrastructure\Persistence\Models\WashLogModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WashLogController extends Controller
{
    public function __construct(
        private CreateWashLogUseCase $createWashLog,
        private GetDailyLogUseCase $getDailyLog,
        private WashLogRepositoryInterface $washLogRepository,
    ) {}

    public function index(Request $request)
    {
        $query = WashLogModel::with(['vehicle', 'service', 'attendant']);

        if ($request->has('date')) {
            $query->where('log_date', $request->date);
        } else {
            $query->where('log_date', now()->toDateString());
        }

        $logs = $query->orderBy('started_at', 'desc')->paginate($request->get('per_page', 50));

        return WashLogResource::collection($logs);
    }

    public function store(CreateWashLogRequest $request): JsonResponse
    {
        $dto = new CreateWashLogDTO(
            tenantId: app('current_tenant_id'),
            vehicleId: $request->vehicle_id,
            serviceId: $request->service_id,
            attendedBy: $request->attended_by,
            createdBy: $request->user()->id,
            priceCharged: $request->price_charged,
            paymentMethod: $request->payment_method,
            reservationId: $request->reservation_id,
            notes: $request->notes,
        );

        $washLog = $this->createWashLog->execute($dto);
        $model = WashLogModel::with(['vehicle', 'service', 'attendant'])->find($washLog->id);

        return (new WashLogResource($model))
            ->response()
            ->setStatusCode(201);
    }

    public function show(string $id): WashLogResource
    {
        $washLog = WashLogModel::with(['vehicle', 'service', 'attendant', 'reservation'])->findOrFail($id);
        return new WashLogResource($washLog);
    }

    public function complete(string $id): JsonResponse
    {
        $this->washLogRepository->complete($id, new \DateTimeImmutable());

        return response()->json([
            'data' => ['message' => 'Wash log completed'],
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
