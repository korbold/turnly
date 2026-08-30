<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;

/**
 * `ResolveTenantMiddleware` deja pasar la request cuando no resuelve el slug
 * —así la app del cliente puede pedir sus vehículos sin pertenecer a ningún
 * negocio— y los controladores del mismo grupo hacen `app('current_tenant_id')`
 * a pelo. Sin bindeo, el contenedor tira BindingResolutionException y el
 * cliente recibe un 500 sin explicación.
 *
 * Pasó en producción el 30 de agosto de 2026: un usuario que es staff en un
 * negocio y cliente en otro entró con un magic link, volvió al panel, y la
 * lista de Clientes murió dos veces con "Target class [current_tenant_id]
 * does not exist".
 */
beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'slug' => 'con-tenant']);
    $this->user = UserModel::factory()->create(['email_verified_at' => now()]);
    TenantUserModel::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->user->id,
        'role' => 'tenant_admin',
        'is_active' => true,
    ]);
    $this->actingAs($this->user, 'sanctum');
});

test('the clients list answers a readable error when no business was sent', function () {
    // Sin cabecera X-Tenant: exactamente lo que manda el panel cuando la sesión
    // se cambió por debajo.
    $response = $this->getJson('/api/v1/client-resources?all=1');

    $response->assertStatus(400);
    $response->assertJsonPath('error.code', 'TENANT_REQUIRED');
});

test('the same list works when the business does travel', function () {
    $response = $this->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/client-resources?all=1');

    $response->assertOk();
});

test('a customer still lists their own resources with no business at all', function () {
    // La mitad suelta del grupo: sin `all`, el cliente pide lo suyo y no
    // necesita negocio. Esto es lo que no hay que romper.
    $response = $this->getJson('/api/v1/client-resources');

    $response->assertOk();
});
