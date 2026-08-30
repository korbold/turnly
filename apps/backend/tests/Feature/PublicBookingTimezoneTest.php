<?php

use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Support\Facades\DB;

/**
 * La hora que el cliente toca en el navegador es la hora a la que el negocio
 * lo espera. Suena obvio y no lo era: `available-slots` devuelve la hora local
 * desnuda ("2026-09-02 09:00:00") y el wizard público la reenviaba pasada por
 * `toISOString()`, o sea en UTC. `new DateTimeImmutable()` respeta la zona que
 * trae el string, así que `format('Y-m-d H:i:s')` escribía las 14:00 en una
 * columna que todo el resto del sistema lee como hora de Guayaquil.
 *
 * El admin y la app Flutter mandan la hora local desnuda y nunca se corrieron.
 * Sólo la web pública, y sin un solo error: la reserva se creaba, bien formada,
 * cinco horas tarde.
 */
beforeEach(function () {
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'slug' => 'tz-shop',
    ]);
    TenantImageModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'storage_path' => '/test.jpg',
        'url' => 'https://example.com/test.jpg',
        'sort_order' => 0,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->variant = ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id,
        'label' => 'Mediano',
        'price' => 6,
        'duration_min' => 30,
    ]);
});

/** La hora local desnuda, tal como queda escrita en la columna. */
function storedHour(): string
{
    return substr((string) DB::table('reservations')->value('scheduled_at'), 11, 5);
}

function bookAt(string $tenantSlug, string $variantId, string $scheduledAt, string $email)
{
    return test()->postJson("/api/v1/public/tenants/{$tenantSlug}/book", [
        'items' => [['service_variant_id' => $variantId, 'qty' => 1]],
        'scheduled_at' => $scheduledAt,
        'client_name' => 'Cliente Web',
        'client_email' => $email,
        'client_resource_data' => ['plate' => 'TZA1234', 'type' => 'sedan'],
    ]);
}

test('booking sent in UTC lands on the local hour the customer picked', function () {
    // El cliente elige las 09:00 de mañana. El navegador manda eso mismo en UTC.
    $local = \Carbon\Carbon::tomorrow(config('app.timezone'))->setTime(9, 0);
    $utc = $local->copy()->setTimezone('UTC')->format('Y-m-d\TH:i:s.v\Z');

    bookAt($this->tenant->slug, $this->variant->id, $utc, 'utc@example.com')
        ->assertCreated();

    expect(storedHour())->toBe('09:00');
});

test('booking sent in local time keeps working', function () {
    // Lo que mandan el panel y la app Flutter: hora local, sin zona.
    $local = \Carbon\Carbon::tomorrow(config('app.timezone'))->setTime(9, 0);

    bookAt($this->tenant->slug, $this->variant->id, $local->format('Y-m-d H:i:s'), 'local@example.com')
        ->assertCreated();

    expect(storedHour())->toBe('09:00');
});

test('estimated_end is stored in the same zone as the start', function () {
    $local = \Carbon\Carbon::tomorrow(config('app.timezone'))->setTime(9, 0);
    $utc = $local->copy()->setTimezone('UTC')->format('Y-m-d\TH:i:s.v\Z');

    bookAt($this->tenant->slug, $this->variant->id, $utc, 'end@example.com')
        ->assertCreated();

    $row = DB::table('reservations')->first();
    expect(substr((string) $row->estimated_end, 11, 5))->toBe('09:30');
});
