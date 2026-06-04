<?php

namespace App\Infrastructure\Http\Controllers;

use App\Application\Services\PlanLimitsService;
use App\Domain\Reservation\VariantSuggester;
use App\Infrastructure\Notifications\Notifications\NewReservationForAdmin;
use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PlanModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class PublicController extends Controller
{
    public function __construct(private PlanLimitsService $planLimits) {}

    private function hasCustomPage(string $tenantId): bool
    {
        return $this->planLimits->hasFeature($tenantId, 'custom_page');
    }

    public function listPlans(): JsonResponse
    {
        $plans = PlanModel::where('is_active', true)
            ->orderBy('price')
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'slug' => $p->slug,
                'name' => $p->name,
                'description' => $p->description,
                'price' => (float) $p->price,
                'max_services' => $p->max_services,
                'max_reservations_per_month' => $p->max_reservations_per_month,
                'max_employees' => $p->max_employees,
                'has_push_notifications' => (bool) $p->has_push_notifications,
                'has_reports' => (bool) $p->has_reports,
                'has_reminders' => (bool) $p->has_reminders,
                'has_custom_page' => (bool) $p->has_custom_page,
            ]);

        return response()->json(['data' => $plans]);
    }

    public function listCategories(): JsonResponse
    {
        $categories = \App\Infrastructure\Persistence\Models\BusinessCategoryModel::where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'slug', 'name', 'emoji', 'color', 'description']);

        return response()->json(['data' => $categories]);
    }

    public function listTenants(Request $request): JsonResponse
    {
        $query = TenantModel::where('status', 'active')
            ->whereNull('deleted_at')
            ->where(function ($q) {
                $q->where(function ($trial) {
                    $trial->where('is_trial', true)
                        ->where('trial_ends_at', '>', now());
                })->orWhereHas('plan', fn ($p) => $p->where('has_custom_page', true));
            })
            ->orderBy('name');

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->has('business_type')) {
            $query->where('business_type', $request->business_type);
        }

        $tenants = $query->paginate($request->get('per_page', 20));

        $data = $tenants->map(fn ($t) => [
            'slug' => $t->slug,
            'name' => $t->name,
            'description' => $t->description,
            'business_type' => $t->business_type,
            'logo_url' => $t->logo_url,
            'cover_url' => $t->cover_url,
            'address' => $t->address,
            'phone' => $t->phone,
        ]);

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $tenants->currentPage(),
                'last_page' => $tenants->lastPage(),
                'total' => $tenants->total(),
            ],
        ]);
    }

    /**
     * Suggests the best variant for a customer's resource on a given
     * service. Used by the Flutter picker to pre-select an option (e.g.
     * "Camioneta $55") instead of forcing the customer to guess.
     */
    public function suggestVariant(Request $request, string $serviceId): JsonResponse
    {
        $request->validate([
            'resource_id' => 'required|uuid',
        ]);

        $service = ServiceModel::withoutGlobalScopes()
            ->with(['variants' => fn ($q) => $q->where('is_active', true)])
            ->find($serviceId);
        if (!$service) {
            return response()->json(['data' => null]);
        }

        $resource = ClientResourceModel::withoutGlobalScopes()->find($request->resource_id);
        if (!$resource || $resource->tenant_id !== $service->tenant_id) {
            return response()->json(['data' => null]);
        }

        $tenant = TenantModel::find($service->tenant_id);
        $customFields = $tenant?->custom_fields ?? [];
        if (!is_array($customFields)) $customFields = (array) $customFields;

        $suggested = app(VariantSuggester::class)->suggest(
            resource: $resource,
            variants: $service->variants,
            customFields: $customFields,
        );

        if (!$suggested) {
            return response()->json(['data' => null]);
        }

        return response()->json([
            'data' => [
                'variant_id' => $suggested->id,
                'label' => $suggested->label,
                'price' => (float) $suggested->price,
                'duration_min' => (int) $suggested->duration_min,
                'reason' => 'Sugerido por tu ' . ($resource->label ?: 'recurso'),
            ],
        ]);
    }

    public function getTenant(string $slug): JsonResponse
    {
        $tenant = TenantModel::where('slug', $slug)
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->first();

        if (!$tenant) {
            return response()->json([
                'error' => ['code' => 'NOT_FOUND', 'message' => 'Negocio no encontrado'],
            ], 404);
        }

        if (!$this->hasCustomPage($tenant->id)) {
            return response()->json([
                'error' => ['code' => 'NOT_FOUND', 'message' => 'Negocio no encontrado'],
            ], 404);
        }

        $services = ServiceModel::query()
            ->forTenant($tenant->id)
            ->where('is_active', true)
            ->with(['variants' => function ($q) {
                $q->where('is_active', true)
                  ->orderBy('sort_order')
                  ->orderBy('price');
            }])
            ->orderBy('sort_order')
            ->get(['id', 'name', 'description', 'price', 'image_url'])
            ->map(function ($svc) {
                return [
                    'id' => $svc->id,
                    'name' => $svc->name,
                    'description' => $svc->description,
                    'price' => $svc->price,
                    'image_url' => $svc->image_url,
                    // Surface active variants to the customer so the app can
                    // show "Desde $X" + open the size picker. The "Default"
                    // backfill variant is hidden so it doesn't clutter the
                    // picker; the customer either sees real variants or a
                    // single flat price.
                    'variants' => $svc->variants
                        ->where('label', '!=', 'Default')
                        ->values()
                        ->map(fn ($v) => [
                            'id' => $v->id,
                            'label' => $v->label,
                            'price' => (float) $v->price,
                            'duration_min' => (int) $v->duration_min,
                            'sort_order' => (int) $v->sort_order,
                        ])->all(),
                ];
            });

        $availability = AvailabilitySlotModel::query()
            ->forTenant($tenant->id)
            ->where('is_active', true)
            ->orderBy('day_of_week')
            ->get(['day_of_week', 'start_time', 'end_time']);

        $images = $tenant->images()->get(['id', 'url', 'caption']);

        return response()->json([
            'data' => [
                'tenant' => [
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'description' => $tenant->description,
                    'business_type' => $tenant->business_type,
                    'logo_url' => $tenant->logo_url,
                    'cover_url' => $tenant->cover_url,
                    'brand_theme' => $tenant->brand_theme,
                    'social_links' => $tenant->social_links,
                    'address' => $tenant->address,
                    'phone' => $tenant->phone,
                    'custom_fields' => $tenant->custom_fields,
                    'slot_duration' => $tenant->settings['slot_duration_minutes'] ?? 30,
                    'cancellation_hours' => $tenant->settings['cancellation_hours'] ?? 1,
                ],
                'services' => $services,
                'availability' => $availability,
                'images' => $images,
            ],
        ]);
    }

    public function getAvailableSlots(string $slug, Request $request): JsonResponse
    {
        $request->validate([
            'service_id'   => 'nullable|uuid',
            'date'         => 'required|date|after_or_equal:today',
            // Pass an explicit duration when booking multiple services
            // (sum of the chosen variants' durations).
            'duration_min' => 'nullable|integer|min:1|max:480',
            'variant_ids'  => 'nullable|array',
            'variant_ids.*' => 'uuid',
        ]);

        $tenant = TenantModel::where('slug', $slug)->where('status', 'active')->firstOrFail();

        if (!$this->hasCustomPage($tenant->id)) {
            abort(404);
        }

        $date = new \DateTimeImmutable($request->date);
        $dayOfWeek = (int) $date->format('N') - 1;
        $tenantSlot = (int) ($tenant->settings['slot_duration_minutes'] ?? 30);
        // Effective slot length: explicit > sum of variants > tenant default.
        $durationMinutes = $request->integer('duration_min');
        if (!$durationMinutes && !empty($request->variant_ids)) {
            $durationMinutes = (int) ServiceVariantModel::withoutGlobalScopes()
                ->whereIn('id', $request->variant_ids)
                ->where('tenant_id', $tenant->id)
                ->sum('duration_min');
        }
        if (!$durationMinutes) {
            $durationMinutes = $tenantSlot;
        }

        $availabilitySlots = AvailabilitySlotModel::query()
            ->forTenant($tenant->id)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->get();

        if ($availabilitySlots->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $existingReservations = ReservationModel::query()
            ->forTenant($tenant->id)
            ->whereDate('scheduled_at', $request->date)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->get();

        $slots = [];

        foreach ($availabilitySlots as $availability) {
            $startTime = new \DateTimeImmutable($request->date . ' ' . $availability->start_time);
            $endTime = new \DateTimeImmutable($request->date . ' ' . $availability->end_time);
            $maxConcurrent = $availability->max_concurrent;
            // Advance the pointer by the tenant's base slot so the picker
            // still shows 30/45/etc. start options, even if the service
            // duration spans several slots.
            $stepMinutes = $tenantSlot;
            $current = $startTime;

            while ($current->modify("+{$durationMinutes} minutes") <= $endTime) {
                $slotEnd = $current->modify("+{$durationMinutes} minutes");
                $overlapping = 0;

                foreach ($existingReservations as $reservation) {
                    $resStart = new \DateTimeImmutable($reservation->scheduled_at);
                    $resEnd = new \DateTimeImmutable($reservation->estimated_end);
                    if ($current < $resEnd && $slotEnd > $resStart) {
                        $overlapping++;
                    }
                }

                $slots[] = [
                    'start' => $current->format('Y-m-d H:i:s'),
                    'end' => $slotEnd->format('Y-m-d H:i:s'),
                    'available' => max(0, $maxConcurrent - $overlapping),
                ];

                $current = $current->modify("+{$stepMinutes} minutes");
            }
        }

        return response()->json(['data' => $slots]);
    }

    public function myResources(string $slug, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['data' => []]);
        }

        $tenant = TenantModel::where('slug', $slug)->where('status', 'active')->firstOrFail();

        if (!$this->hasCustomPage($tenant->id)) {
            abort(404);
        }

        $resources = ClientResourceModel::query()
            ->forTenant($tenant->id)
            ->where('client_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        $data = $resources->map(fn ($r) => [
            'id' => $r->id,
            'data' => $r->data,
            'plate' => $r->plate,
            'brand' => $r->brand,
            'model' => $r->model,
            'color' => $r->color,
            'type' => $r->type,
            'created_at' => $r->created_at?->toIso8601String(),
        ]);

        return response()->json(['data' => $data]);
    }

    public function book(string $slug, Request $request): JsonResponse
    {
        // Multi-service booking: clients send `items[]` (each one a
        // service_variant_id + qty). The legacy single `service_id` is
        // still accepted so the older Flutter build keeps working until
        // every client is updated.
        $authenticatedUser = $request->user('sanctum');

        $baseRules = [
            'scheduled_at'         => 'required|date|after:now',
            'notes'                => 'nullable|string|max:500',
            'client_resource_id'   => 'nullable|uuid',
            'client_resource_data' => 'nullable|array',
            'service_id'           => 'nullable|uuid',
            'items'                => 'nullable|array|min:1|max:10',
            'items.*.service_variant_id' => 'required_with:items|uuid',
            'items.*.qty'                => 'nullable|integer|min:1|max:10',
        ];

        if (!$authenticatedUser) {
            $baseRules = array_merge($baseRules, [
                'client_name'  => 'required|string|max:255',
                'client_email' => 'required|email|max:255',
                'client_phone' => 'nullable|string|max:20',
            ]);
        }

        $request->validate($baseRules);

        if (empty($request->items) && !$request->service_id) {
            return response()->json([
                'error' => ['code' => 'NO_ITEMS', 'message' => 'Selecciona al menos un servicio.'],
            ], 422);
        }

        $tenant = TenantModel::where('slug', $slug)->where('status', 'active')->firstOrFail();
        if (!$this->hasCustomPage($tenant->id)) abort(404);

        // Resolve variants up front so we can validate tenancy + total duration.
        [$resolvedItems, $totalDurationMin, $firstServiceId, $firstVariantId] =
            $this->resolveBookingItems($tenant->id, $request);

        if ($resolvedItems === null) {
            return response()->json([
                'error' => ['code' => 'INVALID_ITEMS', 'message' => 'Items inválidos para este negocio.'],
            ], 422);
        }

        $client = $authenticatedUser ?: UserModel::firstOrCreate(
            ['email' => $request->client_email],
            [
                'name' => $request->client_name,
                'phone' => $request->client_phone,
                'password' => bcrypt(Str::random(16)),
                'is_super_admin' => false,
            ]
        );

        TenantUserModel::firstOrCreate(
            ['tenant_id' => $tenant->id, 'user_id' => $client->id],
            ['role' => 'client', 'is_active' => true]
        );

        $clientResourceId = $request->client_resource_id;
        if (!$clientResourceId && $request->client_resource_data) {
            $resourceData = $request->client_resource_data;
            $resource = ClientResourceModel::withoutGlobalScopes()->create([
                'tenant_id' => $tenant->id,
                'client_id' => $client->id,
                'plate' => strtoupper($resourceData['plate'] ?? ''),
                'brand' => $resourceData['brand'] ?? null,
                'model' => $resourceData['model'] ?? null,
                'color' => $resourceData['color'] ?? null,
                'type' => $resourceData['type'] ?? 'sedan',
                'data' => $resourceData,
            ]);
            $clientResourceId = $resource->id;
        }

        $scheduledAt = new \DateTimeImmutable($request->scheduled_at);
        $estimatedEnd = $scheduledAt->modify("+{$totalDurationMin} minutes");

        // Tenants that don't review every booking (car wash, lavandería)
        // can flip `auto_confirm_reservations` in settings so customer
        // submissions land directly as `confirmed` and skip the manual
        // "Confirmar cita" step in the dashboard.
        $autoConfirm = (bool) ($tenant->settings['auto_confirm_reservations'] ?? false);
        $initialStatus = $autoConfirm ? 'confirmed' : 'pending';

        $reservation = DB::transaction(function () use ($tenant, $client, $clientResourceId, $resolvedItems, $firstServiceId, $firstVariantId, $scheduledAt, $estimatedEnd, $request, $initialStatus) {
            $r = ReservationModel::withoutGlobalScopes()->create([
                'id' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'client_id' => $client->id,
                'client_resource_id' => $clientResourceId,
                // Legacy single-service pointer kept for older listings;
                // the canonical source of truth is reservation_items.
                'service_id' => $firstServiceId,
                'service_variant_id' => $firstVariantId,
                'scheduled_at' => $scheduledAt->format('Y-m-d H:i:s'),
                'estimated_end' => $estimatedEnd->format('Y-m-d H:i:s'),
                'status' => $initialStatus,
                'notes' => $request->notes,
                'created_by' => $client->id,
            ]);

            $sort = 0;
            foreach ($resolvedItems as $it) {
                ReservationItemModel::create([
                    'tenant_id'      => $tenant->id,
                    'reservation_id' => $r->id,
                    'item_type'      => 'service_variant',
                    'ref_id'         => $it['variant_id'],
                    'label'          => $it['label'],
                    'qty'            => $it['qty'],
                    'unit_price'     => $it['price'],
                    'line_total'     => $it['price'] * $it['qty'],
                    'sort_order'     => $sort++,
                ]);
            }

            return $r;
        });

        $total = array_reduce(
            $resolvedItems,
            fn ($acc, $i) => $acc + ($i['price'] * $i['qty']),
            0.0
        );

        // Notify the tenant's staff that a customer booked. The legacy
        // CreateReservationUseCase owns this for tenant-portal bookings;
        // the public/book endpoint creates rows directly, so the dispatch
        // needs to live here too. Swallow failures so a broken FCM doesn't
        // block the 201.
        try {
            $modelWithRelations = ReservationModel::with(['service', 'client', 'tenant'])
                ->find($reservation->id);
            if ($modelWithRelations) {
                $admins = $tenant
                    ->users()
                    ->wherePivotIn('role', ['owner', 'tenant_admin', 'cashier'])
                    ->wherePivot('is_active', true)
                    ->get();
                if ($admins->isNotEmpty()) {
                    Notification::send($admins, new NewReservationForAdmin($modelWithRelations));
                }
            }
        } catch (\Throwable $e) {
            Log::error('Failed to send new reservation notification', ['error' => $e->getMessage()]);
        }

        return response()->json([
            'data' => [
                'reservation_id' => $reservation->id,
                'status' => 'pending',
                'scheduled_at' => $reservation->scheduled_at,
                'estimated_end' => $reservation->estimated_end,
                'duration_min' => $totalDurationMin,
                'total' => round($total, 2),
                'items' => array_map(
                    fn ($i) => [
                        'service_variant_id' => $i['variant_id'],
                        'service_id'         => $i['service_id'],
                        'label'              => $i['label'],
                        'qty'                => $i['qty'],
                        'unit_price'         => $i['price'],
                        'line_total'         => round($i['price'] * $i['qty'], 2),
                        'duration_min'       => $i['duration_min'],
                    ],
                    $resolvedItems
                ),
                'message' => 'Reserva creada exitosamente',
            ],
        ], 201);
    }

    /**
     * Resolves the incoming items (new shape) or the legacy `service_id`
     * payload into a normalized list of [variant_id, service_id, label,
     * qty, price, duration_min]. Returns the total duration plus the
     * first (service_id, variant_id) for the legacy columns on the
     * reservation row.
     *
     * @return array{0: array<int, array{variant_id:string,service_id:string,label:string,qty:int,price:float,duration_min:int}>|null, 1: int, 2: ?string, 3: ?string}
     */
    private function resolveBookingItems(string $tenantId, Request $request): array
    {
        $tenantSlotMinutes = (int) (TenantModel::find($tenantId)?->settings['slot_duration_minutes'] ?? 30);

        if (!empty($request->items)) {
            $variantIds = collect($request->items)->pluck('service_variant_id')->all();
            $variants = ServiceVariantModel::withoutGlobalScopes()
                ->whereIn('id', $variantIds)
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->with('service')
                ->get()
                ->keyBy('id');

            $resolved = [];
            $total = 0;
            $firstService = null;
            $firstVariant = null;

            foreach ($request->items as $row) {
                $variant = $variants->get($row['service_variant_id']);
                if (!$variant) {
                    return [null, 0, null, null];
                }
                $qty = (int) ($row['qty'] ?? 1);
                $duration = max(1, (int) $variant->duration_min) * $qty;
                $total += $duration;

                if (!$firstService) $firstService = $variant->service_id;
                if (!$firstVariant) $firstVariant = $variant->id;

                $serviceName = $variant->service?->name ?? 'Servicio';

                $resolved[] = [
                    'variant_id'   => $variant->id,
                    'service_id'   => $variant->service_id,
                    'label'        => "{$serviceName} · {$variant->label}",
                    'qty'          => $qty,
                    'price'        => (float) $variant->price,
                    'duration_min' => (int) $variant->duration_min * $qty,
                ];
            }

            return [$resolved, $total, $firstService, $firstVariant];
        }

        // Legacy single-service path: synthesize one item from the
        // default variant (or pick the first active one).
        $serviceId = $request->service_id;
        $variant = ServiceVariantModel::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('service_id', $serviceId)
            ->where('is_active', true)
            ->orderByRaw("CASE WHEN label = 'Default' THEN 0 ELSE 1 END")
            ->orderBy('sort_order')
            ->with('service')
            ->first();

        if (!$variant) {
            // Service exists but has no variants yet — keep the
            // reservation but skip line items. ConsumptionEngine still
            // picks the right variant at `complete` via the service_id.
            $service = ServiceModel::withoutGlobalScopes()->find($serviceId);
            if (!$service || $service->tenant_id !== $tenantId) {
                return [null, 0, null, null];
            }
            return [[], $tenantSlotMinutes, $service->id, null];
        }

        $serviceName = $variant->service?->name ?? 'Servicio';
        $duration = max(1, (int) $variant->duration_min);

        return [
            [[
                'variant_id'   => $variant->id,
                'service_id'   => $variant->service_id,
                'label'        => "{$serviceName} · {$variant->label}",
                'qty'          => 1,
                'price'        => (float) $variant->price,
                'duration_min' => $duration,
            ]],
            $duration,
            $variant->service_id,
            $variant->id,
        ];
    }
}
