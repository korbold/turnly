<?php

use App\Infrastructure\Persistence\Models\UserModel;

/**
 * El límite por cuenta leía `email` pero el login manda `identifier`: todas
 * las cuentas compartían un cupo de 5 por minuto. Seis personas entrando en
 * el mismo minuto —un cambio de turno— y la sexta recibía 429.
 */
test('one account burning its attempts does not lock the others out', function () {
    $victim = UserModel::factory()->create(['email' => 'cajera@lavadora.ec', 'password' => 'correcta123']);

    foreach (range(1, 5) as $_) {
        $this->postJson('/api/v1/auth/login', ['identifier' => 'otra@lavadora.ec', 'password' => 'mala'], ['REMOTE_ADDR' => '10.0.0.'.$_]);
    }

    $this->postJson('/api/v1/auth/login', ['identifier' => 'cajera@lavadora.ec', 'password' => 'correcta123'], ['REMOTE_ADDR' => '10.0.0.9'])
        ->assertOk();
});

test('the same account is still capped at 5 attempts a minute', function () {
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/login', ['identifier' => 'dueno@lavadora.ec', 'password' => 'mala'], ['REMOTE_ADDR' => '10.0.1.'.$i]);
    }

    $this->postJson('/api/v1/auth/login', ['identifier' => 'dueno@lavadora.ec', 'password' => 'mala'], ['REMOTE_ADDR' => '10.0.1.9'])
        ->assertStatus(429);
});
