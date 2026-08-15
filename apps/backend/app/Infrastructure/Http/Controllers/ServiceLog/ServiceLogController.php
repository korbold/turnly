<?php

namespace App\Infrastructure\Http\Controllers\ServiceLog;

use App\Application\DTOs\ServiceLog\CreateServiceLogDTO;
use App\Application\UseCases\ServiceLog\CreateServiceLogUseCase;
use App\Application\UseCases\ServiceLog\GetDailyLogUseCase;
use App\Domain\Billing\ConsumidorFinalLimit;
use App\Domain\Identity\EcuadorIdValidator;
use App\Domain\Inventory\ConsumptionEngine;
use App\Domain\Inventory\StockLedger;
use App\Domain\ServiceLog\Contracts\ServiceLogRepositoryInterface;
use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\ServiceLog\CreateServiceLogRequest;
use App\Infrastructure\Http\Resources\ServiceLogResource;
use App\Infrastructure\Jobs\EmitServiceLogInvoiceJob;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ServiceLogItemModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceLogController extends Controller
{
    public function __construct(
        private CreateServiceLogUseCase $createServiceLog,
        private GetDailyLogUseCase $getDailyLog,
        private ServiceLogRepositoryInterface $serviceLogRepository,
        private ConsumptionEngine $consumption,
        private StockLedger $stock,
    ) {}

    public function index(Request $request)
    {
        // `items` is eager-loaded so the LogList row can render the
        // multi-service rollup ("Lavada + Pulido +1 más") off the
        // services_summary block in the resource without per-row queries.
        $query = ServiceLogModel::with(['clientResource.client', 'service', 'attendant', 'items.variant']);

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

        // A counter sale can be products only, so the "primary service"
        // is the first *service* line — null when nothing was rendered.
        $primaryServiceId = $hasItems
            ? ($this->firstServiceLine($items)['service_id'] ?? null)
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
            $this->persistItems($serviceLog->id, $items, $request->user()?->id);

            // Bonus: stamp the first service line's variant on the parent
            // so legacy queries that look at `service_variant_id` (reports
            // grouping by variant, BOM consumption) still see the
            // representative variant rather than NULL.
            $firstVariant = $this->firstServiceLine($items)['variant_id'] ?? null;
            if ($firstVariant) {
                ServiceLogModel::where('id', $serviceLog->id)
                    ->update(['service_variant_id' => $firstVariant]);
            }
        }

        $model = ServiceLogModel::with(['clientResource', 'service', 'attendant', 'items.variant'])
            ->find($serviceLog->id);

        return (new ServiceLogResource($model))
            ->response()
            ->setStatusCode(201);
    }

    public function show(string $id): ServiceLogResource
    {
        $serviceLog = ServiceLogModel::with([
            'clientResource.client', 'service', 'attendant', 'reservation', 'items.variant',
        ])->findOrFail($id);
        return new ServiceLogResource($serviceLog);
    }

    /** A line without an explicit type is a service — the legacy shape. */
    private function isProductLine(array $line): bool
    {
        return ($line['item_type'] ?? 'service_variant') === 'product';
    }

    private function firstServiceLine(array $items): array
    {
        foreach ($items as $line) {
            if (!$this->isProductLine($line)) {
                return $line;
            }
        }

        return [];
    }

    /**
     * Writes the line items and moves stock for the product ones: a
     * counter sale has to leave the kardex, otherwise inventory keeps
     * reporting bottles that were already handed over.
     */
    private function persistItems(string $serviceLogId, array $items, ?string $userId): void
    {
        $tenantId = app('current_tenant_id');
        $sort = 0;

        foreach ($items as $line) {
            $unit      = (float) $line['unit_price'];
            $qty       = (float) $line['qty'];
            $isProduct = $this->isProductLine($line);

            $refId = $isProduct
                ? $line['product_id']
                : (!empty($line['variant_id']) ? $line['variant_id'] : $line['service_id']);

            ServiceLogItemModel::create([
                'tenant_id'      => $tenantId,
                'service_log_id' => $serviceLogId,
                'item_type'      => $isProduct ? 'product' : 'service_variant',
                'ref_id'         => $refId,
                'label'          => $line['label'],
                'qty'            => $qty,
                'unit_price'     => $unit,
                'line_total'     => $unit * $qty,
                'sort_order'     => $sort++,
            ]);

            if ($isProduct) {
                $product = ProductModel::find($refId);
                if ($product) {
                    $this->stock->recordSale(
                        product: $product,
                        qty:     $qty,
                        userId:  $userId,
                        refType: 'service_log',
                        refId:   $serviceLogId,
                    );
                }
            }
        }
    }

    /**
     * Puts sold units back before the items are replaced or the log is
     * deleted, so editing a ticket doesn't quietly double-count stock.
     */
    private function returnProductStock(ServiceLogModel $log, ?string $userId): void
    {
        foreach ($log->items()->where('item_type', 'product')->get() as $item) {
            $product = ProductModel::find($item->ref_id);
            if (!$product) {
                continue;
            }

            $this->stock->recordReturn(
                product: $product,
                qty:     (float) $item->qty,
                userId:  $userId,
                refType: 'service_log',
                refId:   $log->id,
                note:    'Reverso por edición del registro',
            );
        }
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
            'items.*.item_type'      => 'nullable|in:service_variant,product',
            'items.*.service_id'     => 'nullable|uuid',
            'items.*.product_id'     => 'nullable|uuid',
            'items.*.variant_id'     => 'nullable|uuid',
            'items.*.label'          => 'required|string|max:200',
            'items.*.qty'            => 'required|numeric|min:0.01',
            'items.*.unit_price'     => 'required|numeric|min:0',
        ]);

        $items  = $request->input('items');
        $userId = $request->user()?->id;

        // Wrap the delete + insert + parent-update in a single transaction
        // so a mid-loop constraint failure can never leave the log in a
        // corrupt state (old items gone, new items half-written).
        \Illuminate\Support\Facades\DB::transaction(function () use ($serviceLog, $items, $userId) {
            // Sold units go back on the shelf before the lines are
            // replaced; persistItems then books the new sale. Editing a
            // ticket twice would otherwise discount the stock twice.
            $this->returnProductStock($serviceLog, $userId);

            // Replace all items atomically — delete then re-insert so sort
            // order resets cleanly and orphaned rows can never accumulate.
            $serviceLog->items()->delete();

            $this->persistItems($serviceLog->id, $items, $userId);

            // Re-derive parent columns from the new item list so legacy
            // queries (reports grouping by service_id) remain correct.
            $newTotal    = array_sum(array_map(fn ($it) => (float) $it['unit_price'] * (float) $it['qty'], $items));
            $firstService = $this->firstServiceLine($items);
            $serviceLog->update([
                'service_id'         => $firstService['service_id'] ?? null,
                'price_charged'      => $newTotal,
                'service_variant_id' => $firstService['variant_id'] ?? null,
            ]);
        });

        return new ServiceLogResource(
            $serviceLog->load(['clientResource', 'service', 'attendant', 'items.variant'])
        );
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $serviceLog = ServiceLogModel::findOrFail($id);

        // A paid or invoiced log is a financial/fiscal record — it must not
        // be deleted (an emitted factura is corrected via nota de crédito,
        // never by erasing the underlying sale).
        if ($serviceLog->payment_status === 'paid' || $serviceLog->invoice_status !== null) {
            return response()->json([
                'error' => [
                    'code'    => 'LOG_LOCKED',
                    'message' => 'No se puede eliminar un registro pagado o facturado.',
                ],
            ], 422);
        }

        // Deleting an unpaid ticket un-sells whatever went with it.
        $this->returnProductStock($serviceLog, $request->user()?->id);

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

        // Facturación is now a manual step: recording payment only marks
        // the log paid. The SRI invoice is emitted on demand via invoice()
        // (POST /service-logs/{id}/invoice), surfaced as the "Facturar"
        // button in the admin. Do NOT auto-dispatch here.

        return (new ServiceLogResource(
            $log->load(['clientResource', 'service', 'attendant'])
        ))->response()->setStatusCode(200);
    }

    public function invoice(string $id): JsonResponse
    {
        $log = ServiceLogModel::with('clientResource.client')->findOrFail($id);

        if ($log->invoice_status === 'autorizada') {
            return response()->json([
                'error' => [
                    'code'    => 'ALREADY_INVOICED',
                    'message' => 'Esta factura ya fue autorizada por el SRI.',
                ],
            ], 422);
        }

        // Answer before the SRI does: a consumidor final over $50 is a
        // guaranteed rejection that would burn a secuencial.
        $ivaMode = TenantModel::find($log->tenant_id)?->settings['iva_mode'] ?? 'excluded';

        if (ConsumidorFinalLimit::blocks(
            $this->billsToConsumidorFinal($log->clientResource?->client?->id),
            ConsumidorFinalLimit::totalWithIva((float) $log->price_charged, $ivaMode),
        )) {
            return response()->json([
                'error' => [
                    'code'    => ConsumidorFinalLimit::CODE,
                    'message' => ConsumidorFinalLimit::MESSAGE,
                ],
            ], 422);
        }

        EmitServiceLogInvoiceJob::dispatch($id);

        return response()->json([
            'data' => ['message' => 'Facturación iniciada.'],
        ], 202);
    }

    /**
     * Mirrors EmitServiceLogInvoiceJob::resolveBillingProfile — no client,
     * or no default profile, or a profile still on `final_consumer` all
     * end up billing to CONSUMIDOR FINAL.
     */
    private function billsToConsumidorFinal(?string $clientId): bool
    {
        if (!$clientId) {
            return true;
        }

        $docType = UserBillingProfileModel::where('user_id', $clientId)
            ->where('is_default', true)
            ->value('doc_type');

        return $docType === null || $docType === 'final_consumer';
    }

    /**
     * Returns the fiscal profile the factura will use for this log's
     * client, mapped for the admin form. Falls back to CONSUMIDOR FINAL
     * when the client has no default billing profile yet. Used to
     * prefill the "Datos de facturación" correction dialog.
     */
    public function showBilling(string $id): JsonResponse
    {
        $log    = ServiceLogModel::with('clientResource.client')->findOrFail($id);
        $client = $log->clientResource?->client;

        $profile = $client
            ? UserBillingProfileModel::where('user_id', $client->id)->where('is_default', true)->first()
            : null;

        return response()->json(['data' => [
            'doc_type'   => $profile->doc_type   ?? 'final_consumer',
            'doc_number' => $profile->doc_number ?? '',
            'legal_name' => $profile->legal_name ?? '',
            'email'      => $profile->email      ?? ($client->email ?? ''),
            'address'    => $profile->address    ?? '',
            'phone'      => $profile->phone      ?? '',
        ]]);
    }

    /**
     * Corrects the client's default fiscal profile (the one the factura
     * reads at emit time). Edits the default profile IN PLACE so fixing a
     * typo doesn't spawn a duplicate; creates one when none exists. This
     * is the occasional-correction path — emitting the factura itself
     * stays a one-click action against whatever this resolves to.
     */
    public function updateBilling(Request $request, string $id): JsonResponse
    {
        $log    = ServiceLogModel::with('clientResource.client')->findOrFail($id);
        $client = $log->clientResource?->client;

        if (!$client) {
            return response()->json([
                'error' => ['code' => 'NO_CLIENT', 'message' => 'Este registro no tiene cliente asociado.'],
            ], 422);
        }

        $data = $request->validate([
            'doc_type'   => ['required', 'in:final_consumer,cedula,ruc,passport'],
            'doc_number' => ['nullable', 'string', 'max:20'],
            'legal_name' => ['nullable', 'string', 'max:300'],
            'email'      => ['nullable', 'email', 'max:190'],
            'address'    => ['nullable', 'string', 'max:300'],
            'phone'      => ['nullable', 'string', 'max:40'],
        ]);

        $docType   = $data['doc_type'];
        $docNumber = trim((string) ($data['doc_number'] ?? ''));
        $legalName = trim((string) ($data['legal_name'] ?? ''));
        $email     = trim((string) ($data['email'] ?? ''));

        if ($docType === 'final_consumer') {
            $docNumber = '9999999999999';
            $legalName = $legalName !== '' ? $legalName : 'CONSUMIDOR FINAL';
        } else {
            if ($docType === 'cedula' && !EcuadorIdValidator::isCedula($docNumber)) {
                return response()->json(['error' => ['code' => 'INVALID_CEDULA', 'message' => 'Cédula inválida.']], 422);
            }
            if ($docType === 'ruc' && !EcuadorIdValidator::isRuc($docNumber)) {
                return response()->json(['error' => ['code' => 'INVALID_RUC', 'message' => 'RUC inválido.']], 422);
            }
            if ($docNumber === '' || $legalName === '') {
                return response()->json(['error' => ['code' => 'MISSING_FISCAL', 'message' => 'Documento y razón social son obligatorios.']], 422);
            }
            if ($email === '') {
                return response()->json(['error' => ['code' => 'MISSING_EMAIL', 'message' => 'El email es obligatorio para enviar el XML autorizado.']], 422);
            }
        }

        $attrs = [
            'doc_type'   => $docType,
            'doc_number' => $docNumber,
            'legal_name' => $legalName,
            'email'      => $email !== '' ? $email : null,
            'address'    => $data['address'] ?? null,
            'phone'      => $data['phone'] ?? null,
        ];

        $profile = UserBillingProfileModel::where('user_id', $client->id)->where('is_default', true)->first();

        if ($profile) {
            $profile->update($attrs);
        } else {
            $profile = UserBillingProfileModel::create($attrs + [
                'user_id'    => $client->id,
                'is_default' => true,
            ]);
        }

        return response()->json(['data' => [
            'doc_type'   => $profile->doc_type,
            'doc_number' => $profile->doc_number,
            'legal_name' => $profile->legal_name,
            'email'      => $profile->email ?? '',
            'address'    => $profile->address ?? '',
            'phone'      => $profile->phone ?? '',
        ]]);
    }

    public function indexInvoiced(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $query = ServiceLogModel::with(['clientResource.client', 'service', 'attendant'])
            ->whereNotNull('invoice_status');

        if ($request->has('status')) {
            $query->where('invoice_status', $request->status);
        }

        if ($request->has('date_from')) {
            $query->whereDate('log_date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('log_date', '<=', $request->date_to);
        }

        $logs = $query->orderBy('invoiced_at', 'desc')
            ->paginate($request->get('per_page', 50));

        return ServiceLogResource::collection($logs);
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

    public function downloadInvoiceXml(string $id): \Symfony\Component\HttpFoundation\StreamedResponse|\Illuminate\Http\JsonResponse
    {
        $log = ServiceLogModel::findOrFail($id);

        if (! $log->invoice_external_id) {
            return response()->json(['error' => ['code' => 'NO_INVOICE', 'message' => 'No hay factura para este registro.']], 404);
        }

        /** @var BillingServiceClient $billingClient */
        $billingClient = app(BillingServiceClient::class);
        $xml = $billingClient->getInvoiceXml($log->invoice_external_id);

        return response()->streamDownload(
            fn () => print($xml),
            "{$log->invoice_clave_acceso}.xml",
            ['Content-Type' => 'application/xml']
        );
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
