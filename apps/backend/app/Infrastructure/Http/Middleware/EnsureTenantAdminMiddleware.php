<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Middleware;

use App\Infrastructure\Persistence\Models\TenantUserModel;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Lo que solo decide el dueño o el admin: el equipo (roles, contraseñas) y la
 * facturación del negocio. Va detrás de `tenant.member`, que ya resolvió el
 * negocio y dejó afuera a quien no es personal.
 */
class EnsureTenantAdminMiddleware
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();

        if ($user && $user->is_super_admin) {
            return $next($request);
        }

        $role = TenantUserModel::where('tenant_id', app('current_tenant_id'))
            ->where('user_id', $user?->id)
            ->where('is_active', true)
            ->value('role');

        if (! in_array($role, ['owner', 'tenant_admin'], true)) {
            return new JsonResponse([
                'error' => [
                    'code'    => 'FORBIDDEN',
                    'message' => 'Solo el dueño o el administrador pueden hacer esto.',
                ],
            ], 403);
        }

        return $next($request);
    }
}
