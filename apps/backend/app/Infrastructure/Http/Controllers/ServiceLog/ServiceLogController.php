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

        // Variant id + payment metadata ride on the model rather than
        // the DTO so we don't have to ripple them through the domain
        // pipeline. Bank is only stamped for transferencia; method +
        // bank are nulled when the cashier deferred cobro a la entrega.
        $paymentStatus = $request->get('payment_status', 'paid');
        $patch = [];
        if ($request->service_variant_id) {
            $patch['service_variant_id'] = $request->service_variant_id;
        }
        if ($paymentStatus === 'unpaid') {
            $patch['payment_status'] = 'unpaid';
            $patch['paid_at'] = null;
            $patch['payment_method'] = null;
            $patch['payment_bank'] = null;
        } else {
            $patch['payment_status'] = 'paid';
            $patch['paid_at'] = now();
            if ($request->payment_method === 'transfer' && $request->filled('payment_bank')) {
                $patch['payment_bank'] = $request->payment_bank;
            }
        }
        ServiceLogModel::where('id', $serviceLog->id)->update($patch);

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
            'payment_bank' => 'nullable|string|max:40',
            'notes' => 'nullable|string|max:500',
        ]);

        $serviceLog->update($request->only([
            'service_id', 'attended_by', 'price_charged', 'payment_method', 'payment_bank', 'notes',
        ]));

        return new ServiceLogResource($serviceLog->load(['clientResource', 'service', 'attendant']));
    }

    public function destroy(string $id): JsonResponse
    {
        $serviceLog = ServiceLogModel::findOrFail($id);
        $serviceLog->delete();

        return response()->json(['data' => ['message' => 'Registro eliminado']], 200);
    }

    /**
     * Records the moment + method a customer paid for a service log
     * that was registered as "cobrar al retirar". Mirrors the reserva
     * payment endpoint shape so the admin uses the same modal.
     */
    public function recordPayment(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'method'    => ['required', 'in:cash,card,transfer,other'],
            'bank'      => ['nullable', 'string', 'max:40'],
            'reference' => ['nullable', 'string', 'max:100'],
        ]);

        $log = ServiceLogModel::findOrFail($id);
        if ($log->payment_status === 'paid') {
            return response()->json([
                'error' => [
                    'code'    => 'ALREADY_PAID',
                    'message' => 'Este servicio ya está marcado como pagado.',
                ],
            ], 422);
        }

        $log->update([
            'payment_method' => $data['method'],
            'payment_bank'   => $data['method'] === 'transfer' ? ($data['bank'] ?? null) : null,
            'payment_status' => 'paid',
            'paid_at'        => now(),
            // Append reference into notes when supplied; service_logs
            // doesn't carry a dedicated payment_reference column yet
            // and the typical car-wash use case doesn't need one.
            'notes'          => trim(($log->notes ?? '') . ($data['reference'] ?? '' ? "\nRef: {$data['reference']}" : '')) ?: null,
        ]);

        return (new ServiceLogResource(
            $log->load(['clientResource', 'service', 'attendant'])
        ))->response()->setStatusCode(200);
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
