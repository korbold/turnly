<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withCommands([
        __DIR__.'/../app/Infrastructure/Console/Commands',
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant' => \App\Infrastructure\Http\Middleware\ResolveTenantMiddleware::class,
            'super_admin' => \App\Infrastructure\Http\Middleware\EnsureSuperAdminMiddleware::class,
            'verified.email' => \App\Infrastructure\Http\Middleware\EnsureEmailVerifiedMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\App\Domain\Shared\Exceptions\AppException $e, \Illuminate\Http\Request $request) {
            return response()->json([
                'error' => [
                    'code' => $e->getErrorCode(),
                    'message' => $e->getMessage(),
                    'context' => $e->getContext(),
                ]
            ], $e->getStatusCode());
        });
    })->create();
