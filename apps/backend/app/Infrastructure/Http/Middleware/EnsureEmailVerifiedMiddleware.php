<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnsureEmailVerifiedMiddleware
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();
        if ($user && $user->email_verified_at === null) {
            return new JsonResponse([
                'error' => [
                    'code' => 'EMAIL_NOT_VERIFIED',
                    'message' => 'Verifica tu email para continuar.',
                ],
            ], 403);
        }

        return $next($request);
    }
}
