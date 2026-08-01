<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnsureTenantMemberMiddleware
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();

        // Super-admins operate across tenants.
        if ($user && $user->is_super_admin) {
            return $next($request);
        }

        $tenantId = app()->has('current_tenant_id') ? app('current_tenant_id') : null;

        $isMember = $tenantId
            && $user
            && $user->tenants()
                ->where('tenants.id', $tenantId)
                ->wherePivot('is_active', true)
                ->exists();

        if (! $isMember) {
            return new JsonResponse([
                'error' => [
                    'code'    => 'TENANT_FORBIDDEN',
                    'message' => 'No tienes acceso a este negocio.',
                ],
            ], 403);
        }

        return $next($request);
    }
}
