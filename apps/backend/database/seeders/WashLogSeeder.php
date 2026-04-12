<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\VehicleModel;
use App\Infrastructure\Persistence\Models\WashLogModel;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class WashLogSeeder extends Seeder
{
    /**
     * 30 wash_logs per tenant over last 14 days.
     * Payment split: ~60% cash, ~25% card, ~15% transfer.
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
        $services = ServiceModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->get();

        $vehicles = VehicleModel::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->get();

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

        // Payment methods pool: 60% cash, 25% card, 15% transfer (totals 100 for easy ratio)
        $paymentPool = array_merge(
            array_fill(0, 18, 'cash'),    // 60%
            array_fill(0, 8,  'card'),    // ~27%
            array_fill(0, 4,  'transfer') // ~13%
        );
        shuffle($paymentPool);

        // Build log dates: 30 entries spread over 14 days (~2-3 per day)
        $logDates = $this->buildLogDates(14, 30);

        for ($i = 0; $i < 30; $i++) {
            $service  = $services[$i % $services->count()];
            $vehicle  = $vehicles[$i % $vehicles->count()];
            $logDate  = $logDates[$i];
            $payment  = $paymentPool[$i % count($paymentPool)];

            // Business-hour start time
            $startHour = rand(8, 16);
            $startedAt = $logDate->copy()->setTime($startHour, rand(0, 59), 0);
            $finishedAt = $startedAt->copy()->addMinutes(30);

            WashLogModel::withoutGlobalScopes()->create([
                'id'             => Str::uuid(),
                'tenant_id'      => $tenant->id,
                'vehicle_id'     => $vehicle->id,
                'service_id'     => $service->id,
                'reservation_id' => null,
                'attended_by'    => $washer->id,
                'created_by'     => $cashier->id,
                'started_at'     => $startedAt,
                'finished_at'    => $finishedAt,
                'price_charged'  => $service->price,
                'payment_method' => $payment,
                'status'         => 'completed',
                'notes'          => null,
                'log_date'       => $logDate->toDateString(),
            ]);
        }
    }

    /**
     * Generate $total Carbon dates distributed over the last $days days.
     * Skips Sundays. Returns shuffled array.
     */
    private function buildLogDates(int $days, int $total): array
    {
        $pool = [];
        $now  = Carbon::now();

        for ($d = 0; $d < $days; $d++) {
            $date = $now->copy()->subDays($d)->startOfDay();
            if ($date->dayOfWeek === 0) {
                continue; // Skip Sundays
            }
            // Add 2-3 slots per day
            $slotsPerDay = ($d % 3 === 0) ? 3 : 2;
            for ($s = 0; $s < $slotsPerDay; $s++) {
                $pool[] = $date->copy();
            }
        }

        // Trim or pad to exactly $total entries
        while (count($pool) < $total) {
            $pool[] = $now->copy()->subDays(rand(1, $days))->startOfDay();
        }

        $pool = array_slice($pool, 0, $total);
        shuffle($pool);

        return $pool;
    }
}
