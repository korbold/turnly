<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Magic link request limiter. Two keys at once: per-email blocks
        // bombing of a single inbox even when the attacker rotates IPs;
        // per-IP catches a script enumerating many emails from one host.
        RateLimiter::for('magic-link-email', function (Request $request) {
            $email = strtolower(trim((string) $request->input('email', '')));

            return [
                Limit::perMinutes(10, 3)->by("magic-link-email:{$email}"),
                Limit::perMinutes(10, 5)->by("magic-link-ip:{$request->ip()}"),
            ];
        });

        // Failsafe ceiling on the entire endpoint to cap Resend cost
        // and contain large botnet-driven floods.
        RateLimiter::for('magic-link-global', function (Request $request) {
            return Limit::perHour(500)->by('magic-link-global');
        });
    }
}
