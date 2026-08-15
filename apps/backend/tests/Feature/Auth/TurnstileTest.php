<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

// The endpoint sends the link itself; faking mail keeps these tests about
// the anti-bot gate and nothing else.
beforeEach(fn () => Mail::fake());

// Before the Cloudflare keys exist the check must be invisible, or
// shipping this would lock everyone out of the magic link.
test('requests pass through when no secret is configured', function () {
    config(['services.turnstile.secret' => null]);
    Http::fake();

    $this->postJson('/api/v1/auth/magic-link/request', ['email' => 'alguien@example.com'])
        ->assertOk();
});

test('a configured secret rejects a request with no token', function () {
    config(['services.turnstile.secret' => 'test-secret']);

    $this->postJson('/api/v1/auth/magic-link/request', ['email' => 'alguien@example.com'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'TURNSTILE_FAILED');
});

test('a token Cloudflare rejects does not reach the endpoint', function () {
    config(['services.turnstile.secret' => 'test-secret']);
    Http::fake([
        'challenges.cloudflare.com/*' => Http::response(['success' => false, 'error-codes' => ['invalid-input-response']]),
    ]);

    $this->postJson('/api/v1/auth/magic-link/request', [
        'email' => 'alguien@example.com',
        'turnstile_token' => 'bogus',
    ])->assertStatus(422)->assertJsonPath('error.code', 'TURNSTILE_FAILED');
});

test('a token Cloudflare accepts goes through', function () {
    config(['services.turnstile.secret' => 'test-secret']);
    Http::fake([
        'challenges.cloudflare.com/*' => Http::response(['success' => true]),
    ]);

    $this->postJson('/api/v1/auth/magic-link/request', [
        'email' => 'alguien@example.com',
        'turnstile_token' => 'good',
    ])->assertOk();
});

// A widget that cannot be verified must not become a free pass.
test('an unreachable Cloudflare fails closed', function () {
    config(['services.turnstile.secret' => 'test-secret']);
    Http::fake(function () {
        throw new \Illuminate\Http\Client\ConnectionException('timeout');
    });

    $this->postJson('/api/v1/auth/magic-link/request', [
        'email' => 'alguien@example.com',
        'turnstile_token' => 'good',
    ])->assertStatus(422)->assertJsonPath('error.code', 'TURNSTILE_FAILED');
});
