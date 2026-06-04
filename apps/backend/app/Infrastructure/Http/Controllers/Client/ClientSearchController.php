<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Client;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Walk-in cashier search. Returns *only* the identity that's safe to
 * share across tenants — name, email, phone, billing doc number — plus
 * a relation flag for the current tenant. Nothing about other tenants'
 * reservations, vehicles or activity leaks.
 */
class ClientSearchController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));
        if (mb_strlen($q) < 3) {
            return response()->json(['data' => []]);
        }

        $tenantId = app('current_tenant_id');
        $like = '%' . $q . '%';

        $users = UserModel::query()
            ->leftJoin('user_billing_profiles as bp', function ($j) {
                $j->on('bp.user_id', '=', 'users.id')->where('bp.is_default', true);
            })
            ->leftJoin('tenant_users as tu', function ($j) use ($tenantId) {
                $j->on('tu.user_id', '=', 'users.id')->where('tu.tenant_id', $tenantId);
            })
            ->where(function ($w) use ($like) {
                $w->where('users.name', 'like', $like)
                    ->orWhere('users.email', 'like', $like)
                    ->orWhere('users.phone', 'like', $like)
                    ->orWhere('bp.doc_number', 'like', $like);
            })
            ->where('users.is_super_admin', false)
            ->select([
                'users.id', 'users.name', 'users.email', 'users.phone',
                'users.claimed_at', 'users.created_by_walkin',
                'bp.doc_type as billing_doc_type',
                'bp.doc_number as billing_doc_number',
                'tu.role as tenant_role',
                'tu.is_active as tenant_active',
            ])
            ->orderByRaw('CASE WHEN tu.role IS NOT NULL THEN 0 ELSE 1 END')
            ->orderBy('users.name')
            ->limit(10)
            ->get();

        $data = $users->map(function ($u) use ($tenantId) {
            $relation = $u->tenant_role
                ? ($u->tenant_active ? 'client_active' : 'client_inactive')
                : 'not_linked';

            $resourcesInTenant = ClientResourceModel::query()
                ->forTenant($tenantId)
                ->where('client_id', $u->id)
                ->count();

            return [
                'id'             => $u->id,
                'name'           => $u->name,
                'email'          => $u->email,
                'phone'          => $u->phone,
                'is_ghost'       => $u->claimed_at === null && $u->created_by_walkin,
                'billing'        => $u->billing_doc_number ? [
                    'doc_type'   => $u->billing_doc_type,
                    'doc_number' => $u->billing_doc_number,
                ] : null,
                // Privacy: only relation TO THE CURRENT TENANT. We never
                // leak whether the customer uses other businesses.
                'tenant_relation'      => $relation,
                'resources_in_tenant'  => $resourcesInTenant,
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function linkToTenant(Request $request, string $userId): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $user = UserModel::findOrFail($userId);

        DB::transaction(function () use ($tenantId, $user) {
            $existing = TenantUserModel::where('tenant_id', $tenantId)
                ->where('user_id', $user->id)
                ->first();

            if ($existing) {
                if (!$existing->is_active) {
                    $existing->update(['is_active' => true]);
                }
                return;
            }

            TenantUserModel::create([
                'tenant_id' => $tenantId,
                'user_id'   => $user->id,
                'role'      => 'client',
                'is_active' => true,
            ]);
        });

        return response()->json([
            'data' => ['message' => 'Cliente vinculado a tu negocio'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
