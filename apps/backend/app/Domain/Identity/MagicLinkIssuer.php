<?php

declare(strict_types=1);

namespace App\Domain\Identity;

use Illuminate\Support\Facades\DB;

/**
 * Emite los links de entrada sin contraseña que consume `/m/{token}`.
 *
 * Vivía dentro de `MagicLinkController::request()`, hasta que el correo de
 * confirmación de reserva necesitó emitir uno igual con otra vigencia. Dos
 * copias de esto es cómo se termina con un link que caduca distinto según
 * quién lo mandó.
 *
 * Un solo link vivo por correo: pedir uno nuevo mata el anterior, así el que
 * quedó en un buzón viejo no sirve.
 */
final class MagicLinkIssuer
{
    /** El del login: se pide y se usa en el momento. */
    public const TTL_LOGIN_MINUTES = 15;

    /**
     * El del correo de confirmación. Ese correo se abre cuando el cliente lo
     * abre —esa noche, el fin de semana—, así que quince minutos lo dejarían
     * inservible casi siempre. Sigue siendo de un solo uso.
     */
    public const TTL_BOOKING_MINUTES = 60 * 24 * 7;

    public function issue(
        string $email,
        int $ttlMinutes,
        ?string $requestIp = null,
        ?string $userAgent = null,
    ): string {
        $email = strtolower(trim($email));
        $token = bin2hex(random_bytes(32));

        DB::table('magic_link_tokens')
            ->where('email', $email)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        DB::table('magic_link_tokens')->insert([
            'email' => $email,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addMinutes($ttlMinutes),
            'request_ip' => $requestIp,
            'request_user_agent' => $userAgent ? substr($userAgent, 0, 255) : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $token;
    }

    public function urlFor(string $token): string
    {
        $host = config('app.frontend_host', 'goturnly.com');

        return "https://{$host}/m/{$token}";
    }
}
