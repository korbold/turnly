<?php

use App\Infrastructure\Mail\MagicLinkMail;
use App\Infrastructure\Mail\PasswordResetMail;
use Illuminate\Support\Facades\Mail;

/**
 * `Headers(messageId:)` de Symfony recibe el id SIN los ángulos: los pone él.
 * Pasárselos ya puestos deja una cabecera que no cumple RFC 2822, Symfony tira
 * RfcComplianceException y el correo no sale.
 *
 * En producción esto llevaba desde el 3 de julio de 2026: el link de entrada
 * al portal nunca llegó a ninguna bandeja. No se notó porque la cuenta de
 * demo cortocircuita el envío y es con la que siempre se probó.
 *
 * Estos tests mandan por el mailer `array`, que construye el mensaje de verdad
 * —Mail::fake() no lo construye, y por eso no habría visto nada.
 */
test('the magic link email builds a valid message', function () {
    Mail::to('cliente@example.com')->send(new MagicLinkMail(
        email: 'cliente@example.com',
        magicUrl: 'https://goturnly.com/m/' . str_repeat('a', 64),
        ttlMinutes: 15,
    ));

    $messages = app('mailer')->getSymfonyTransport()->messages();
    expect($messages)->toHaveCount(1);

    // El mensaje crudo, tal como sale: un par de ángulos, no dos.
    $raw = $messages[0]->getMessage()->toString();
    expect($raw)->toMatch('/^Message-Id: <[^<>@]+@goturnly\.com>\r?$/mi');
});

test('the password reset email builds a valid message', function () {
    Mail::to('cliente@example.com')->send(new PasswordResetMail(
        name: 'Cliente',
        resetUrl: 'https://goturnly.com/reset-password?token=abc',
        ttlMinutes: 60,
    ));

    $messages = app('mailer')->getSymfonyTransport()->messages();
    expect($messages)->toHaveCount(1);

    $raw = $messages[0]->getMessage()->toString();
    expect($raw)->toMatch('/^Message-Id: <[^<>@]+@goturnly\.com>\r?$/mi');
});
