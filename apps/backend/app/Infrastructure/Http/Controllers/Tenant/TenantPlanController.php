<?php

namespace App\Infrastructure\Http\Controllers\Tenant;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\PlanModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class TenantPlanController extends Controller
{
    public function show(): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $tenant = TenantModel::findOrFail($tenantId);
        $plan = $tenant->plan_id ? PlanModel::find($tenant->plan_id) : null;

        $servicesUsed = ServiceModel::where('tenant_id', $tenantId)->count();
        $reservationsUsed = ReservationModel::where('tenant_id', $tenantId)
            ->where('created_at', '>=', Carbon::now()->startOfMonth())
            ->count();
        $employeesUsed = TenantUserModel::where('tenant_id', $tenantId)
            ->whereIn('role', ['cashier', 'washer'])
            ->count();

        $available = PlanModel::where('is_active', true)
            ->orderBy('price')
            ->get();

        $isTrialActive = $tenant->is_trial
            && $tenant->trial_ends_at !== null
            && $tenant->trial_ends_at->isFuture();

        return response()->json([
            'data' => [
                'current' => $plan ? $this->serializePlan($plan) : null,
                'is_trial' => (bool) $isTrialActive,
                'trial_ends_at' => $tenant->trial_ends_at?->toIso8601String(),
                'usage' => [
                    'services' => $servicesUsed,
                    'reservations_this_month' => $reservationsUsed,
                    'employees' => $employeesUsed,
                ],
                'available' => $available->map(fn ($p) => $this->serializePlan($p))->all(),
            ],
        ]);
    }

    private function serializePlan(PlanModel $p): array
    {
        return [
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
            'is_active' => (bool) $p->is_active,
        ];
    }
}
