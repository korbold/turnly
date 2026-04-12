<?php

namespace App\Infrastructure\Http\Controllers;

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PublicController extends Controller
{
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

        $services = ServiceModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'name', 'description', 'price', 'image_url']);

        $availability = AvailabilitySlotModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
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

        $date = new \DateTimeImmutable($request->date);
        $dayOfWeek = (int) $date->format('N') - 1;
        $durationMinutes = 30;

        $availabilitySlots = AvailabilitySlotModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->get();

        if ($availabilitySlots->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $existingReservations = ReservationModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
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

                if ($overlapping < $maxConcurrent) {
                    $slots[] = [
                        'start' => $current->format('Y-m-d H:i:s'),
                        'end' => $slotEnd->format('Y-m-d H:i:s'),
                        'available' => $maxConcurrent - $overlapping,
                    ];
                }

                $current = $current->modify('+30 minutes');
            }
        }

        return response()->json(['data' => $slots]);
    }

    public function book(string $slug, Request $request): JsonResponse
    {
        $request->validate([
            'service_id' => 'required|uuid',
            'scheduled_at' => 'required|date|after:now',
            'client_name' => 'required|string|max:255',
            'client_email' => 'required|email|max:255',
            'client_phone' => 'nullable|string|max:20',
            'notes' => 'nullable|string|max:500',
            'client_resource_data' => 'nullable|array',
        ]);

        $tenant = TenantModel::where('slug', $slug)->where('status', 'active')->firstOrFail();

        $client = UserModel::firstOrCreate(
            ['email' => $request->client_email],
            [
                'name' => $request->client_name,
                'phone' => $request->client_phone,
                'password' => bcrypt(Str::random(16)),
                'is_super_admin' => false,
            ]
        );

        $clientResourceId = null;
        if ($request->client_resource_data) {
            $resource = ClientResourceModel::withoutGlobalScopes()->create([
                'tenant_id' => $tenant->id,
                'client_id' => $client->id,
                'label' => $request->client_name,
                'data' => $request->client_resource_data,
            ]);
            $clientResourceId = $resource->id;
        }

        $scheduledAt = new \DateTimeImmutable($request->scheduled_at);
        $estimatedEnd = $scheduledAt->modify('+30 minutes');

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
