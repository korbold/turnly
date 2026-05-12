<?php

namespace App\Infrastructure\Http\Controllers;

use App\Application\Services\PlanLimitsService;
use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PlanModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            ->orderBy('sort_order')
            ->get(['id', 'name', 'description', 'price', 'image_url']);

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
            'service_id' => 'required|uuid',
            'date' => 'required|date|after_or_equal:today',
        ]);

        $tenant = TenantModel::where('slug', $slug)->where('status', 'active')->firstOrFail();

        if (!$this->hasCustomPage($tenant->id)) {
            abort(404);
        }

        $date = new \DateTimeImmutable($request->date);
        $dayOfWeek = (int) $date->format('N') - 1;
        $durationMinutes = $tenant->settings['slot_duration_minutes'] ?? 30;

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

                $current = $current->modify("+{$durationMinutes} minutes");
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
        // If user is authenticated, use their data; otherwise require name/email
        $authenticatedUser = $request->user('sanctum');

        if ($authenticatedUser) {
            $request->validate([
                'service_id' => 'required|uuid',
                'scheduled_at' => 'required|date|after:now',
                'notes' => 'nullable|string|max:500',
                'client_resource_id' => 'nullable|uuid',
                'client_resource_data' => 'nullable|array',
            ]);
        } else {
            $request->validate([
                'service_id' => 'required|uuid',
                'scheduled_at' => 'required|date|after:now',
                'client_name' => 'required|string|max:255',
                'client_email' => 'required|email|max:255',
                'client_phone' => 'nullable|string|max:20',
                'notes' => 'nullable|string|max:500',
                'client_resource_data' => 'nullable|array',
            ]);
        }

        $tenant = TenantModel::where('slug', $slug)->where('status', 'active')->firstOrFail();

        if (!$this->hasCustomPage($tenant->id)) {
            abort(404);
        }

        if ($authenticatedUser) {
            $client = $authenticatedUser;
        } else {
            $client = UserModel::firstOrCreate(
                ['email' => $request->client_email],
                [
                    'name' => $request->client_name,
                    'phone' => $request->client_phone,
                    'password' => bcrypt(Str::random(16)),
                    'is_super_admin' => false,
                ]
            );
        }

        // Ensure client is linked to tenant with client role
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
        $slotDuration = $tenant->settings['slot_duration_minutes'] ?? 30;
        $estimatedEnd = $scheduledAt->modify("+{$slotDuration} minutes");

        $reservation = ReservationModel::withoutGlobalScopes()->create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'client_id' => $client->id,
            'client_resource_id' => $clientResourceId,
            'service_id' => $request->service_id,
            'scheduled_at' => $scheduledAt->format('Y-m-d H:i:s'),
            'estimated_end' => $estimatedEnd->format('Y-m-d H:i:s'),
            'status' => 'pending',
            'notes' => $request->notes,
            'created_by' => $client->id,
        ]);

        return response()->json([
            'data' => [
                'reservation_id' => $reservation->id,
                'status' => 'pending',
                'scheduled_at' => $reservation->scheduled_at,
                'message' => 'Reserva creada exitosamente',
            ],
        ], 201);
    }
}
