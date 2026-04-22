<?php

namespace App\Application\Services;

use App\Infrastructure\Persistence\Models\PlanModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Carbon\Carbon;

class PlanLimitsService
{
    public function canCreateService(string $tenantId): bool
    {
        $tenant = TenantModel::find($tenantId);
        if (!$tenant) return false;

        if ($this->isTrialActive($tenant)) return true;

        $plan = $this->getPlan($tenant);
        if (!$plan) return false;
        if ($plan->max_services === null) return true;

        $current = ServiceModel::where('tenant_id', $tenantId)->count();
        return $current < $plan->max_services;
    }

    public function canCreateReservation(string $tenantId): bool
    {
        $tenant = TenantModel::find($tenantId);
        if (!$tenant) return false;

        if ($this->isTrialActive($tenant)) return true;

        $plan = $this->getPlan($tenant);
        if (!$plan) return false;
        if ($plan->max_reservations_per_month === null) return true;

        $current = ReservationModel::where('tenant_id', $tenantId)
            ->where('created_at', '>=', Carbon::now()->startOfMonth())
            ->count();
        return $current < $plan->max_reservations_per_month;
    }

    public function canAddEmployee(string $tenantId): bool
    {
        $tenant = TenantModel::find($tenantId);
        if (!$tenant) return false;

        if ($this->isTrialActive($tenant)) return true;

        $plan = $this->getPlan($tenant);
        if (!$plan) return false;
        if ($plan->max_employees === null) return true;

        $current = TenantUserModel::where('tenant_id', $tenantId)
            ->whereIn('role', ['cashier', 'washer'])
            ->count();
        return $current < $plan->max_employees;
    }

    public function hasFeature(string $tenantId, string $feature): bool
    {
        $tenant = TenantModel::find($tenantId);
        if (!$tenant) return false;

        if ($this->isTrialActive($tenant)) return true;

        $plan = $this->getPlan($tenant);
        if (!$plan) return false;

        return match ($feature) {
            'push_notifications' => $plan->has_push_notifications,
            'reports'            => $plan->has_reports,
            'reminders'          => $plan->has_reminders,
            'custom_page'        => $plan->has_custom_page,
            default              => false,
        };
    }

    private function isTrialActive(TenantModel $tenant): bool
    {
        return $tenant->is_trial
            && $tenant->trial_ends_at !== null
            && $tenant->trial_ends_at->isFuture();
    }

    private function getPlan(TenantModel $tenant): ?PlanModel
    {
        if (!$tenant->plan_id) return null;

        return PlanModel::find($tenant->plan_id);
    }
}
