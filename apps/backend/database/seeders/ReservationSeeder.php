<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\VehicleModel;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ReservationSeeder extends Seeder
{
    /**
     * 20 reservations per tenant spread across the last 7 days.
     * Status distribution: 5 completed, 5 confirmed, 5 pending, 3 cancelled, 2 no_show.
     */
    public function run(): void
    {
        $tenants = TenantModel::all();

        foreach ($tenants as $tenant) {
            $this->seedForTenant($tenant);
        }
    }

    private function seedForTenant(TenantModel $tenant): void
    {
        // Gather tenant data
        $services = ServiceModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->get();

        $clients = TenantUserModel::where('tenant_id', $tenant->id)
            ->where('role', 'client')
            ->with('user')
            ->get()
            ->pluck('user');

        $cashier = TenantUserModel::where('tenant_id', $tenant->id)
            ->where('role', 'cashier')
            ->with('user')
            ->first()
            ->user;

        $washer = TenantUserModel::where('tenant_id', $tenant->id)
            ->where('role', 'washer')
            ->with('user')
            ->first()
            ->user;

        // Statuses and their counts
        $statusPool = array_merge(
            array_fill(0, 5, 'completed'),
            array_fill(0, 5, 'confirmed'),
            array_fill(0, 5, 'pending'),
            array_fill(0, 3, 'cancelled'),
            array_fill(0, 2, 'no_show'),
        );

        // Business hours slots across last 7 days
        $slots = $this->buildSlots(7);
        shuffle($slots);

        foreach ($statusPool as $index => $status) {
            $slot = $slots[$index % count($slots)];

            /** @var Carbon $scheduledAt */
            $scheduledAt = $slot['at'];
            $now         = Carbon::now();

            // Adjust scheduling logic to match status semantics
            if (in_array($status, ['pending'])) {
                // Pending = future
                if ($scheduledAt->lte($now)) {
                    $scheduledAt = $now->copy()->addDays(rand(1, 3))->setTime(rand(8, 16), 0, 0);
                }
            } elseif (in_array($status, ['completed', 'no_show'])) {
                // These make more sense in the past
                if ($scheduledAt->gte($now)) {
                    $scheduledAt = $now->copy()->subDays(rand(1, 6))->setTime(rand(8, 16), 0, 0);
                }
            }

            $client  = $clients[$index % $clients->count()];
            $service = $services[$index % $services->count()];

            $vehicle = VehicleModel::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('owner_id', $client->id)
                ->first();

            $estimatedEnd = $scheduledAt->copy()->addMinutes($service->duration_minutes);

            $cancelledAt  = null;
            $cancelReason = null;
            if ($status === 'cancelled') {
                $cancelledAt  = $scheduledAt->copy()->subHours(rand(1, 48));
                $cancelReason = 'Cliente solicitó cancelación.';
            }

            ReservationModel::withoutGlobalScopes()->create([
                'id'            => Str::uuid(),
                'tenant_id'     => $tenant->id,
                'client_id'     => $client->id,
                'vehicle_id'    => $vehicle?->id,
                'service_id'    => $service->id,
                'assigned_to'   => $washer->id,
                'scheduled_at'  => $scheduledAt,
                'estimated_end' => $estimatedEnd,
                'status'        => $status,
                'notes'         => null,
                'cancelled_at'  => $cancelledAt,
                'cancel_reason' => $cancelReason,
                'created_by'    => $cashier->id,
            ]);
        }
    }

    /** Build a pool of business-hour slots over the last $days days. */
    private function buildSlots(int $days): array
    {
        $slots = [];
        $now   = Carbon::now();
        // Hours: 08:00 – 17:00 (so that estimated_end stays within 18:00 for a 60-min service)
        $hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

        for ($d = 0; $d <= $days; $d++) {
            $date = $now->copy()->subDays($d);
            // Skip Sundays (dayOfWeek === 0 in Carbon)
            if ($date->dayOfWeek === 0) {
                continue;
            }
            foreach ($hours as $h) {
                $slots[] = ['at' => $date->copy()->setTime($h, 0, 0)];
            }
        }

        return $slots;
    }
}
