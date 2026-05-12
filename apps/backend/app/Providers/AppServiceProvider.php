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

        // Login: caps password brute-force per email and per source IP.
        RateLimiter::for('login', function (Request $request) {
            $email = strtolower(trim((string) $request->input('email', '')));

            return [
                Limit::perMinute(5)->by("login-email:{$email}"),
                Limit::perMinute(10)->by("login-ip:{$request->ip()}"),
            ];
        });

        // Google sign-in: token validation hits Firebase + DB. Throttle to
        // protect both from token-spam DoS.
        RateLimiter::for('google-auth', function (Request $request) {
            return Limit::perMinute(10)->by("google-auth-ip:{$request->ip()}");
        });

        // Onboarding (creates a tenant + user): expensive write path,
        // tight ceiling per IP keeps mass tenant-creation contained.
        RateLimiter::for('onboarding-register', function (Request $request) {
            return Limit::perHour(2)->by("onboarding-ip:{$request->ip()}");
        });

        // Public booking endpoint: bot can flood a tenant's slot grid.
        // Key is IP + tenant slug so one attacker can't lock a business.
        RateLimiter::for('public-book', function (Request $request) {
            $slug = (string) $request->route('slug');

            return [
                Limit::perMinutes(10, 3)->by("book-ip-tenant:{$request->ip()}:{$slug}"),
                Limit::perMinute(20)->by("book-ip:{$request->ip()}"),
            ];
        });
    }
}
