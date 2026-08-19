<?php

namespace App\Infrastructure\Http\Controllers\ServiceLog;

use App\Application\DTOs\ServiceLog\CreateServiceLogDTO;
use App\Application\Services\PaymentLedger;
use App\Application\Services\ServiceLogEventRecorder;
use App\Application\UseCases\ServiceLog\CreateServiceLogUseCase;
use App\Application\UseCases\ServiceLog\GetDailyLogUseCase;
use App\Domain\Billing\ConsumidorFinalLimit;
use App\Domain\Identity\EcuadorIdValidator;
use App\Domain\Inventory\ConsumptionEngine;
use App\Domain\Inventory\StockLedger;
use App\Domain\ServiceLog\Contracts\ServiceLogRepositoryInterface;
use App\Domain\Tenant\StaffPrivileges;
use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\ServiceLog\CreateServiceLogRequest;
use App\Infrastructure\Http\Resources\ServiceLogResource;
use App\Infrastructure\Jobs\EmitServiceLogInvoiceJob;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ServiceLogItemModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
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
        private ServiceLogEventRecorder $events,
        private PaymentLedger $ledger,
    ) {}

    /**
     * A cashier's work is always attributed to the cashier. The picker is
     * disabled for them in the UI, but that is a suggestion — commissions and
     * per-employee reports read this column, so it is pinned here too. Owners
     * and admins keep the free choice: they do need to log work on behalf of
     * the staff. Returns the id that must be stored, whatever was requested.
     */
    private function resolveAttendedBy(Request $request, ?string $requested): ?string
    {
        return $this->tenantRole($request) === 'cashier' ? $request->user()->id : $requested;
    }

    /** The caller's role inside the tenant currently being served. */
    private function tenantRole(Request $request): ?string
    {
        return TenantUserModel::where('tenant_id', app('current_tenant_id'))
            ->where('user_id', $request->user()->id)
            ->value('role');
    }

    /**
     * Deciding what a service costs, and whether a record ever existed, are
     * granted per role in Configuración → Permisos (default: Admin only). The
     * admin UI hides both controls; this is the half that actually holds.
     */
    private function may(Request $request, string $privilege): bool
    {
        // A super-admin has no tenant_users row — EnsureTenantMemberMiddleware
        // waves them through, so this has to as well or support can't touch a
        // tenant's registro at all.
        if ($request->user()?->is_super_admin) {
            return true;
        }

        $permissions = TenantModel::find(app('current_tenant_id'))?->settings['permissions'] ?? [];

        return StaffPrivileges::granted(
            $this->tenantRole($request),
            $privilege,
            is_array($permissions) ? $permissions : [],
        );
    }

    /**
     * The price a line is *allowed* to carry when the caller can't set prices:
     * the variant's, the service's, or the product's, as registered.
     * Null when the referenced record is gone — the caller-side check then
     * falls back to whatever the line already had.
     */
    private function catalogPrice(array $line): ?float
    {
        if ($this->isProductLine($line)) {
            $price = ProductModel::where('id', $line['product_id'] ?? null)->value('price');
        } elseif (!empty($line['variant_id'])) {
            $price = ServiceVariantModel::where('id', $line['variant_id'])->value('price');
        } else {
            $price = ServiceModel::where('id', $line['service_id'] ?? null)->value('price');
        }

        return $price === null ? null : (float) $price;
    }

    /**
     * Rejects a caller without the Precio privilege who prices a line himself.
     *
     * A line that already exists on the log keeps whatever it was worth — the
     * admin may well have discounted it, and re-pricing to catalog on every
     * cashier edit would silently undo that. A new line has to match catalog.
     *
     * @param  array<string,float>  $existing  ref_id → unit_price already stored
     * @return string|null  the offending line's label, or null when all check out
     */
    private function firstTamperedPrice(array $items, array $existing = []): ?string
    {
        foreach ($items as $line) {
            $submitted = (float) $line['unit_price'];
            $refId = $this->isProductLine($line)
                ? ($line['product_id'] ?? null)
                : (!empty($line['variant_id']) ? $line['variant_id'] : ($line['service_id'] ?? null));

            $allowed = $existing[$refId] ?? $this->catalogPrice($line);
            if ($allowed === null) {
                continue;
            }

            // Cents, not exact equality: the price round-trips through JSON.
            if (abs($submitted - $allowed) > 0.005) {
                return (string) ($line['label'] ?? 'servicio');
            }
        }

        return null;
    }

    private function priceLockedResponse(string $label): JsonResponse
    {
        return response()->json([
            'error' => [
                'code'    => 'PRICE_LOCKED',
                'message' => "Tu rol no tiene permiso para cambiar el precio de \"{$label}\".",
            ],
        ], 403);
    }

    public function index(Request $request)
    {
        // `items` is eager-loaded so the LogList row can render the
        // multi-service rollup ("Lavada + Pulido +1 más") off the
        // services_summary block in the resource without per-row queries.
        $query = ServiceLogModel::with([
            'clientResource.client', 'service', 'attendant', 'items.variant',
            'washer', 'dryer',
        ]);

        // A single day for the Registro Diario, a range for the reports, which
        // list the rows behind their own totals.
        if ($request->filled('date_from') || $request->filled('date_to')) {
            $from = $request->get('date_from', $request->get('date_to'));
            $to   = $request->get('date_to', $from);
            $query->whereBetween('log_date', [$from, $to]);
        } elseif ($request->has('date')) {
            $query->whereDate('log_date', $request->date);
        } else {
            $query->whereDate('log_date', now()->toDateString());
        }

        // The reports slice transfers by bank; the column lives on the log.
        if ($request->filled('payment_bank')) {
            $query->where('payment_bank', $request->get('payment_bank'));
        }

        // One control in the UI, mirroring the PAGO column: either a payment
        // state or a concrete method. They can't be combined — a pending row
        // has no method yet — so they share a single parameter.
        //
        // `pending` significa "algo falta cobrar", no "no se cobró nada": un
        // servicio con $10 de $30 tiene plata pendiente, y esconderlo del
        // filtro es cómo se pierde un cobro. `partial` es el filtro fino.
        $payment = (string) $request->get('payment', '');
        if ($payment === 'paid') {
            $query->where('payment_status', 'paid');
        } elseif ($payment === 'pending') {
            $query->where('payment_status', '!=', 'paid');
        } elseif ($payment === 'partial') {
            $query->where('payment_status', 'partial');
        } elseif (in_array($payment, ['cash', 'card', 'transfer', 'other'], true)) {
            $query->where('payment_method', $payment);
        }

        if (in_array($request->get('status'), ['in_progress', 'completed'], true)) {
            $query->where('status', $request->get('status'));
        }

        // Counter search: plate, brand or owner name. The resource's custom
        // fields live in a json column, which MySQL compares with a binary
        // collation — lowercase both sides or "ibb9762" misses "IBB9762".
        $search = trim((string) $request->get('q', ''));
        if ($search !== '') {
            $like = '%' . $search . '%';
            $likeLower = '%' . mb_strtolower($search) . '%';

            $query->whereHas('clientResource', function ($cr) use ($like, $likeLower) {
                $cr->whereRaw('LOWER(CAST(data AS CHAR)) LIKE ?', [$likeLower])
                    ->orWhereHas('client', function ($c) use ($like) {
                        $c->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like)
                            ->orWhere('phone', 'like', $like);
                    });
            });
        }

        $query->orderBy('started_at', 'desc');

        // Only the sizes the UI offers, so a caller can't ask for 10.000 rows.
        // "all" becomes a single page the size of the filtered result, which
        // keeps the response shape (and meta) identical for the client.
        $requested = (string) $request->get('per_page', 50);
        $perPage = match (true) {
            $requested === 'all'                       => max($query->clone()->count(), 1),
            in_array($requested, ['10', '15', '20'], true) => (int) $requested,
            default                                    => 50,
        };

        $logs = $query->paginate($perPage);

        // Lo que la placa debe de antes, para que el mostrador pueda pedirlo
        // al cobrar. Sale de DOS consultas agregadas para toda la página: una
        // por fila convertiría el Registro Diario en un timeout.
        $deudas = app(\App\Application\Services\DebtLedger::class)
            ->debtByResource(app('current_tenant_id'));

        $logs->getCollection()->transform(function ($log) use ($deudas) {
            $log->setAttribute('resource_debt', (float) ($deudas[$log->client_resource_id] ?? 0));
            return $log;
        });

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

        // Without the Precio privilege, staff register at the catalog price.
        // Nothing is stored before this check, so a tampered payload never
        // lands as a half-written ticket.
        if (!$this->may($request, StaffPrivileges::PRICE)) {
            $lines = $hasItems ? $items : [[
                'service_id' => $request->service_id,
                'variant_id' => $request->service_variant_id,
                'unit_price' => (float) $request->price_charged,
                'label'      => 'servicio',
            ]];

            $tampered = $this->firstTamperedPrice($lines);
            if ($tampered !== null) {
                return $this->priceLockedResponse($tampered);
            }
        }

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
            attendedBy: $this->resolveAttendedBy($request, $request->attended_by),
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
        // Asignados al registrar: opcionales. Van por el modelo y no por el
        // DTO para no arrastrar el pipeline de dominio por dos columnas.
        foreach (['washed_by', 'dried_by'] as $field) {
            if ($request->filled($field)) {
                $patch[$field] = $request->input($field);
            }
        }
        // El estado pagado ya no se escribe acá: lo produce el libro de pagos
        // más abajo, y estas columnas quedan como reflejo suyo.
        if ($paymentStatus === 'unpaid') {
            $patch['payment_status'] = 'unpaid';
            $patch['paid_at'] = null;
            $patch['payment_method'] = null;
            $patch['payment_bank'] = null;
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

        // La bitácora arranca acá: el resto de los eventos se cuelgan de este.
        $logModel = ServiceLogModel::findOrFail($serviceLog->id);
        $this->events->created($logModel, $request->user()?->id);

        // "Cobrar ahora" es un cobro igual que el diferido: sin esto la
        // bitácora mostraba un servicio pagado sin decir nunca cuándo ni con
        // qué método, que es justo lo que se discute cuando falta plata.
        // Cobrar al registrar es un cobro: entra al libro como cualquier otro.
        if ($paymentStatus !== 'unpaid') {
            $total = (float) $logModel->price_charged;
            // Sin `amount_received` se cobra todo: es el registro de siempre.
            // El min() con el total no es defensa contra el usuario: es lo que
            // evita que un dedo gordo en el mostrador convierta $300 en saldo
            // a favor de un walk-in que no vuelve nunca.
            $recibido = $request->filled('amount_received')
                ? min((float) $request->input('amount_received'), $total)
                : $total;

            $this->ledger->recordForServiceLog(
                $logModel,
                $recibido,
                (string) $request->payment_method,
                $request->payment_bank,
                $request->user()?->id,
            );
            $logModel->refresh();

            $this->events->paymentRecorded(
                $logModel,
                (string) $logModel->payment_method,
                $logModel->payment_bank,
                $recibido,
                $request->user()?->id,
                max(0.0, $total - $this->ledger->paidFor($logModel)),
            );
        }

        $model = ServiceLogModel::with(['clientResource', 'service', 'attendant', 'items.variant', 'washer', 'dryer'])
            ->find($serviceLog->id);

        return (new ServiceLogResource($model))
            ->response()
            ->setStatusCode(201);
    }

    public function show(string $id): ServiceLogResource
    {
        $serviceLog = ServiceLogModel::with([
            'clientResource.client', 'service', 'attendant', 'reservation', 'items.variant',
            'washer', 'dryer', 'events.changedBy',
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

    public function update(Request $request, string $id): ServiceLogResource|JsonResponse
    {
        $serviceLog = ServiceLogModel::findOrFail($id);

        // price_charged is the ticket total. Staff may edit everything else on
        // the row (employee, método de pago, notas) but not the money.
        if ($request->has('price_charged') && !$this->may($request, StaffPrivileges::PRICE)) {
            return $this->priceLockedResponse('este registro');
        }

        $request->validate([
            'service_id' => 'nullable|uuid',
            'attended_by' => 'nullable|uuid',
            'price_charged' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|in:cash,card,transfer,other',
            'payment_bank' => 'nullable|string|max:40',
            'notes' => 'nullable|string|max:500',
        ]);

        $payload = $request->only([
            'service_id', 'attended_by', 'price_charged', 'payment_method', 'payment_bank', 'notes',
        ]);

        // Blocking the create but not the edit would leave the hole open: log
        // it as yourself, then reassign a second later.
        if (array_key_exists('attended_by', $payload)) {
            $payload['attended_by'] = $this->resolveAttendedBy($request, $payload['attended_by']);
        }

        // Qué cambió, antes de escribir. El editor guarda método de pago,
        // empleado y notas — sin esto, corregir un cobro de efectivo a
        // transferencia no dejaba ninguna huella.
        $audited = ['attended_by', 'payment_method', 'payment_bank', 'notes', 'price_charged'];
        $changes = [];
        foreach ($audited as $field) {
            if (!array_key_exists($field, $payload)) {
                continue;
            }

            $from = $serviceLog->{$field};
            $to   = $payload[$field];
            if ((string) $from === (string) $to) {
                continue;
            }

            $changes[] = ['field' => $field, 'from' => $from, 'to' => $to];
        }

        $serviceLog->update($payload);

        $this->events->logUpdated($serviceLog, $changes, $request->user()?->id);

        return new ServiceLogResource($serviceLog->load(['clientResource', 'service', 'attendant']));
    }

    public function updateItems(Request $request, string $id): ServiceLogResource|JsonResponse
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

        $totalBefore = (float) $serviceLog->price_charged;

        // Without the Precio privilege staff may still add, remove and
        // re-count lines — that is the daily job. What they can't do is
        // re-price one. Lines already on the log keep their stored price (an
        // admin discount survives a cashier edit); anything new has to come in
        // at catalog.
        if (!$this->may($request, StaffPrivileges::PRICE)) {
            $tampered = $this->firstTamperedPrice(
                $items,
                $serviceLog->items()->pluck('unit_price', 'ref_id')
                    ->map(fn ($p) => (float) $p)
                    ->all(),
            );

            if ($tampered !== null) {
                return $this->priceLockedResponse($tampered);
            }
        }

        // Wrap the delete + insert + parent-update in a single transaction
        // so a mid-loop constraint failure can never leave the log in a
        // corrupt state (old items gone, new items half-written).
        \Illuminate\Support\Facades\DB::transaction(function () use ($serviceLog, $items, $userId, $totalBefore) {
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

            // Dentro de la transacción: un evento sin su cambio miente.
            $this->events->itemsChanged($serviceLog, $totalBefore, $newTotal, $userId);
        });

        return new ServiceLogResource(
            $serviceLog->load(['clientResource', 'service', 'attendant', 'items.variant'])
        );
    }

    /**
     * Asigna o corrige lavador y secador. Dos gates, y el estado del
     * registro decide cuál aplica:
     *
     * - en progreso → privilegio `Asignados` de la matriz (default: Admin y
     *   Cajero). Es la acción del día: el cajero asigna al lavador cuando
     *   arranca y al secador cuando seca.
     * - completado → owner/tenant_admin, regla fija y no configurable. Si
     *   fuera una casilla, alguien podría devolvérsela al cajero y el rastro
     *   pierde el sentido que lo justifica: el reclamo del dueño del
     *   vehículo llega al mostrador, y quien lo atiende no puede ser quien
     *   reescribe el historial.
     */
    public function updateAssignees(Request $request, string $id): ServiceLogResource|JsonResponse
    {
        $log = ServiceLogModel::findOrFail($id);

        if ($log->status === 'completed') {
            $isManager = $request->user()?->is_super_admin
                || in_array($this->tenantRole($request), ['owner', 'tenant_admin'], true);

            if (!$isManager) {
                return response()->json([
                    'error' => [
                        'code'    => 'ASSIGNEES_LOCKED',
                        'message' => 'El servicio ya está completado: solo el administrador puede corregir los asignados.',
                    ],
                ], 403);
            }
        } elseif (!$this->may($request, StaffPrivileges::ASSIGNEES)) {
            return response()->json([
                'error' => [
                    'code'    => 'ASSIGNEES_FORBIDDEN',
                    'message' => 'Tu rol no tiene permiso para asignar personal.',
                ],
            ], 403);
        }

        $request->validate([
            'washed_by' => 'nullable|uuid',
            'dried_by'  => 'nullable|uuid',
        ]);

        // Solo los puestos que el request menciona. Omitir un campo es "no lo
        // toques"; mandarlo en null es "sacá al asignado", y son cosas
        // distintas.
        $positions = [
            'washed_by' => ServiceStaffModel::POSITION_WASHER,
            'dried_by'  => ServiceStaffModel::POSITION_DRYER,
        ];

        $resolved = [];
        foreach ($positions as $field => $position) {
            if (!$request->has($field)) {
                continue;
            }

            $staffId = $request->input($field);
            if ($staffId === null) {
                $resolved[$field] = null;
                continue;
            }

            // forPosition ya filtra activos y acepta 'both'; el TenantScope
            // se encarga de la pertenencia.
            $staff = ServiceStaffModel::forPosition($position)->find($staffId);
            if (!$staff) {
                return response()->json([
                    'message' => 'El personal seleccionado no es válido para ese puesto.',
                    'errors'  => [$field => ['El personal seleccionado no es válido para ese puesto.']],
                ], 422);
            }

            $resolved[$field] = $staff;
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($log, $resolved, $positions, $request) {
            $patch = [];

            foreach ($resolved as $field => $staff) {
                $currentId = $log->{$field};
                $nextId    = $staff?->id;

                if ($currentId === $nextId) {
                    continue;
                }

                $patch[$field] = $nextId;

                // withoutGlobalScopes() bypasses TenantScope on purpose here:
                // $currentId is the log's own already-validated column, never
                // request input, so there's nothing to smuggle across
                // tenants. Never copy this pattern to a value that comes
                // from the request — that's an IDOR waiting to happen.
                $this->events->assigneeChanged(
                    $log,
                    $positions[$field],
                    $currentId ? ServiceStaffModel::withoutGlobalScopes()->find($currentId) : null,
                    $staff,
                    $request->user()?->id,
                );
            }

            if ($patch !== []) {
                $log->update($patch);
            }
        });

        return new ServiceLogResource(
            $log->fresh()->load(['clientResource.client', 'service', 'attendant', 'washer', 'dryer'])
        );
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $serviceLog = ServiceLogModel::findOrFail($id);

        // Erasing a day's row moves the caja total and leaves no trace, so it
        // needs the Eliminar privilege. Staff without it ask instead.
        if (!$this->may($request, StaffPrivileges::DELETE)) {
            return response()->json([
                'error' => [
                    'code'    => 'FORBIDDEN',
                    'message' => 'Tu rol no tiene permiso para eliminar registros.',
                ],
            ], 403);
        }

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
            // Abono: cobrar menos que el saldo. Sin el campo se cobra todo lo
            // que falta, que es lo que hacía antes.
            'amount'    => ['nullable', 'numeric', 'min:0.01'],
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

        $pendiente = max(0.0, (float) $log->price_charged - $this->ledger->paidFor($log));
        $monto = isset($data['amount'])
            ? min((float) $data['amount'], $pendiente)
            : $pendiente;

        $this->ledger->recordForServiceLog(
            $log,
            $monto,
            $data['method'],
            $data['bank'] ?? null,
            $request->user()?->id,
        );

        // La referencia sigue yendo a notas: service_logs no tiene columna
        // propia para ella y el caso típico no la usa.
        if (!empty($data['reference'])) {
            $log->update([
                'notes' => trim(($log->notes ?? '') . "\nRef: {$data['reference']}") ?: null,
            ]);
        }

        $log->refresh();

        $this->events->paymentRecorded(
            $log,
            $data['method'],
            $data['method'] === 'transfer' ? ($data['bank'] ?? null) : null,
            $monto,
            $request->user()?->id,
            max(0.0, (float) $log->price_charged - $this->ledger->paidFor($log)),
        );

        // Facturación is now a manual step: recording payment only marks
        // the log paid. The SRI invoice is emitted on demand via invoice()
        // (POST /service-logs/{id}/invoice), surfaced as the "Facturar"
        // button in the admin. Do NOT auto-dispatch here.

        return (new ServiceLogResource(
            $log->load(['clientResource', 'service', 'attendant'])
        ))->response()->setStatusCode(200);
    }

    public function invoice(Request $request, string $id): JsonResponse
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

        // Una factura del SRI es por el total del servicio. Con saldo
        // pendiente el comprobante no refleja lo cobrado — y desde 2026 una
        // factura a consumidor final no se puede anular nunca, así que el
        // error no tiene vuelta atrás.
        //
        // El umbral es el mismo centavo que usa PaymentLedger::statusFor():
        // sin él, un servicio pagado en dos partes quedaría sin poder
        // facturarse por un resto de punto flotante.
        $pendiente = max(0.0, (float) $log->price_charged - $this->ledger->paidFor($log));
        if ($pendiente > 0.005) {
            return response()->json([
                'error' => [
                    'code'    => 'PAYMENT_INCOMPLETE',
                    'message' => 'No se puede facturar con saldo pendiente: faltan $'
                        . number_format($pendiente, 2) . '.',
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

        $this->events->invoiceRequested($log, $request->user()?->id);

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

    public function complete(Request $request, string $id): JsonResponse
    {
        $log = ServiceLogModel::findOrFail($id);

        // Completar es el momento en que el dato se congela, así que es el
        // momento de exigirlo: un servicio cerrado sin lavador ni secador es
        // exactamente el agujero que esta feature existe para tapar.
        $isCarWash = TenantModel::find(app('current_tenant_id'))?->business_type === 'car_wash';

        if ($isCarWash && (!$log->washed_by || !$log->dried_by)) {
            return response()->json([
                'error' => [
                    'code'    => 'ASSIGNEES_REQUIRED',
                    'message' => 'Asigná lavador y secador antes de completar el servicio.',
                ],
            ], 422);
        }

        // "¿Cobrás ahora, o se va debiendo?" El cajero responde en el único
        // momento en que sabe la respuesta. Sin la marca, un impago sigue
        // siendo un pendiente del día — no un deudor.
        //
        // El `> 0.005` es lo que impide un deudor de cero: marcar un servicio
        // ya saldado lo pondría en la lista debiendo nada.
        $pendiente = max(0.0, (float) $log->price_charged - $this->ledger->paidFor($log));
        if ($request->boolean('left_owing') && $pendiente > 0.005) {
            $log->forceFill(['left_owing' => true])->save();
            $this->events->leftOwing($log, $pendiente, $request->user()?->id);
        }

        $this->serviceLogRepository->complete($id, new \DateTimeImmutable());

        // Apply BOM consumption now that the service is done. Engine is
        // idempotent so a manual retry won't double-debit stock.
        $this->consumption->applyForServiceLog($log);
        $this->events->statusChanged($log, 'in_progress', 'completed', $request->user()?->id);

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
