<?php

namespace App\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenantMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        // Try header first (for API clients like Flutter app)
        $slug = $request->header('X-Tenant');

        // Fallback to subdomain
        if (!$slug) {
            $host = $request->getHost();
            $parts = explode('.', $host);

            if (count($parts) >= 3) {
                $candidate = $parts[0];
                $reserved = ['www', 'api', 'app', 'admin', 'mail', 'static'];

                if (!in_array($candidate, $reserved)) {
                    $slug = $candidate;
                }
            }
        }

        // If no slug resolved, let the request through (public routes)
        if (!$slug) {
            return $next($request);
        }

        // We need to query the tenant. Since we don't have models yet,
        // use DB facade directly to avoid circular dependency.
        $tenant = \Illuminate\Support\Facades\DB::table('tenants')
            ->where('slug', $slug)
            ->whereNull('deleted_at')
            ->first();

        if (!$tenant) {
            return response()->json([
                'error' => [
                    'code' => 'TENANT_NOT_FOUND',
                    'message' => 'Negocio no encontrado',
                ]
            ], 404);
        }

        if ($tenant->status === 'suspended') {
            return response()->json([
                'error' => [
                    'code' => 'TENANT_SUSPENDED',
                    'message' => 'Este negocio está suspendido',
                ]
            ], 403);
        }

        // Bind tenant to container
        app()->instance('current_tenant', $tenant);
        app()->instance('current_tenant_id', $tenant->id);

        return $next($request);
    }
}
