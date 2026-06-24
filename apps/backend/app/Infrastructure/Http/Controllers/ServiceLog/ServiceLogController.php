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
        // `items` is eager-loaded so the LogList row can render the
        // multi-service rollup ("Lavada + Pulido +1 más") off the
        // services_summary block in the resource without per-row queries.
        $query = ServiceLogModel::with(['clientResource', 'service', 'attendant', 'items']);

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
        // Multi-service items[]: when present, the "primary" service_id
        // + price_charged on the parent row are derived from the items
        // so legacy reports keep grouping correctly. Each item also
        // lands in service_log_items for the granular breakdown.
        $items = $request->input('items', []);
        $hasItems = is_array($items) && count($items) > 0;

        $primaryServiceId = $hasItems
            ? $items[0]['service_id']
            : $request->service_id;
        $priceCharged = $hasItems
            ? array_sum(array_map(
                fn ($it) => (float) $it['unit_price'] * (float) $it['qty'],
                $items,
            ))
            : (float) $request->price_charged;

        $dto = new CreateServiceLogDTO(
            tenantId: app('current_tenant_id'),
            clientResourceId: $request->client_resource_id,
            serviceId: $primaryServiceId,
            attendedBy: $request->attended_by,
            createdBy: $request->user()->id,
            priceCharged: $priceCharged,
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

        // Persist multi-service items[]. Each line becomes a row in
        // service_log_items keyed off the parent log; the consumption
        // engine + future reports can iterate them without touching
        // the parent shape. When the cashier picked a variant, ref_id
        // points at the variant — mirrors reservation_items so reports
        // can join service_variants directly.
        if ($hasItems) {
            $sort = 0;
            $tenantId = app('current_tenant_id');
            foreach ($items as $line) {
                $unit = (float) $line['unit_price'];
                $qty  = (float) $line['qty'];
                $refId = !empty($line['variant_id']) ? $line['variant_id'] : $line['service_id'];
                \App\Infrastructure\Persistence\Models\ServiceLogItemModel::create([
                    'tenant_id'      => $tenantId,
                    'service_log_id' => $serviceLog->id,
                    'item_type'      => 'service_variant',
                    'ref_id'         => $refId,
                    'label'          => $line['label'],
                    'qty'            => $qty,
                    'unit_price'     => $unit,
                    'line_total'     => $unit * $qty,
                    'sort_order'     => $sort++,
                ]);
            }

            // Bonus: stamp the first-line variant on the parent so
            // legacy queries that look at `service_variant_id` (reports
            // grouping by variant, BOM consumption) still see the
            // representative variant rather than NULL.
            $firstVariant = $items[0]['variant_id'] ?? null;
            if ($firstVariant) {
                ServiceLogModel::where('id', $serviceLog->id)
                    ->update(['service_variant_id' => $firstVariant]);
            }
        }

        $model = ServiceLogModel::with(['clientResource', 'service', 'attendant', 'items'])
            ->find($serviceLog->id);

        return (new ServiceLogResource($model))
            ->response()
            ->setStatusCode(201);
    }

    public function show(string $id): ServiceLogResource
    {
        $serviceLog = ServiceLogModel::with([
            'clientResource', 'service', 'attendant', 'reservation', 'items',
        ])->findOrFail($id);
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

    public function updateItems(Request $request, string $id): ServiceLogResource
    {
        $serviceLog = ServiceLogModel::findOrFail($id);

        $request->validate([
            'items'                  => 'required|array|min:1',
            'items.*.service_id'     => 'required|uuid',
            'items.*.variant_id'     => 'nullable|uuid',
            'items.*.label'          => 'required|string|max:200',
            'items.*.qty'            => 'required|numeric|min:0.01',
            'items.*.unit_price'     => 'required|numeric|min:0',
        ]);

        $items = $request->input('items');
        $tenantId = app('current_tenant_id');

        // Wrap the delete + insert + parent-update in a single transaction
        // so a mid-loop constraint failure can never leave the log in a
        // corrupt state (old items gone, new items half-written).
        \Illuminate\Support\Facades\DB::transaction(function () use ($serviceLog, $items, $tenantId) {
            // Replace all items atomically — delete then re-insert so sort
            // order resets cleanly and orphaned rows can never accumulate.
            $serviceLog->items()->delete();

            $sort = 0;
            foreach ($items as $line) {
                $unit   = (float) $line['unit_price'];
                $qty    = (float) $line['qty'];
                $refId  = !empty($line['variant_id']) ? $line['variant_id'] : $line['service_id'];

                \App\Infrastructure\Persistence\Models\ServiceLogItemModel::create([
                    'tenant_id'      => $tenantId,
                    'service_log_id' => $serviceLog->id,
                    'item_type'      => 'service_variant',
                    'ref_id'         => $refId,
                    'label'          => $line['label'],
                    'qty'            => $qty,
                    'unit_price'     => $unit,
                    'line_total'     => $unit * $qty,
                    'sort_order'     => $sort++,
                ]);
            }

            // Re-derive parent columns from the new item list so legacy
            // queries (reports grouping by service_id) remain correct.
            $newTotal       = array_sum(array_map(fn ($it) => (float) $it['unit_price'] * (float) $it['qty'], $items));
            $firstVariantId = $items[0]['variant_id'] ?? null;
            $serviceLog->update([
                'service_id'         => $items[0]['service_id'],
                'price_charged'      => $newTotal,
                'service_variant_id' => $firstVariantId,
            ]);
        });

        return new ServiceLogResource(
            $serviceLog->load(['clientResource', 'service', 'attendant', 'items'])
        );
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
