<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cloudflare Turnstile check for the endpoints a bot can abuse without
 * ever logging in: requesting a magic link (sends mail on someone
 * else's behalf) and booking as a guest (creates a user account with no
 * verification at all).
 *
 * Rate limits cap the damage per IP; this raises the cost per attempt.
 *
 * Fails OPEN when no secret is configured, so the app keeps working
 * before the Cloudflare keys exist and in tests. It fails CLOSED once a
 * secret is set — a configured widget that cannot be reached must not
 * become a silent bypass.
 */
class VerifyTurnstileMiddleware
{
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public function handle(Request $request, Closure $next): Response
    {
        $secret = config('services.turnstile.secret');

        if (empty($secret)) {
            return $next($request);
        }

        $token = (string) $request->input('turnstile_token', '');

        if ($token === '') {
            return $this->reject('Falta la verificación anti-bots. Recarga la página e intenta de nuevo.');
        }

        try {
            $response = Http::asForm()
                ->timeout(5)
                ->post(self::VERIFY_URL, [
                    'secret'   => $secret,
                    'response' => $token,
                    'remoteip' => $request->ip(),
                ]);
        } catch (\Throwable $e) {
            Log::warning('[turnstile] verification unreachable', ['error' => $e->getMessage()]);

            return $this->reject('No pudimos verificar tu solicitud. Intenta de nuevo en un momento.');
        }

        if (!($response->json('success') === true)) {
            Log::info('[turnstile] rejected', [
                'ip'     => $request->ip(),
                'errors' => $response->json('error-codes'),
            ]);

            return $this->reject('No pudimos verificar que seas una persona. Intenta de nuevo.');
        }

        return $next($request);
    }

    private function reject(string $message): Response
    {
        return response()->json([
            'error' => ['code' => 'TURNSTILE_FAILED', 'message' => $message],
        ], 422);
    }
}
