<?php

use App\Infrastructure\Mail\ReservationConfirmedMail;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

/**
 * El paso final del asistente promete "ahí te llega la confirmación" desde que
 * se construyó, y nunca se mandó nada: `book()` sólo avisaba al staff. El
 * cliente terminaba con una cuenta creada, un portal esperándolo y ninguna
 * forma de enterarse de que existía.
 *
 * El correo lleva el magic link adentro a propósito: tocarlo lo mete al portal
 * ya logueado y, de paso, prueba que la casilla es suya. Es el registro, cobrado
 * después de reservar en vez de antes.
 */
beforeEach(function () {
    Mail::fake();

    $this->tenant = TenantModel::factory()->create([
        'status' => 'active',
        'slug' => 'mail-shop',
        'name' => 'Peluquería Demo',
    ]);
    TenantImageModel::create([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'storage_path' => '/test.jpg',
        'url' => 'https://example.com/test.jpg',
        'sort_order' => 0,
    ]);

    $service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Corte niños',
    ]);
    $this->service = $service;
    ServiceVariantModel::create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id,
        'label' => 'Default',
        'price' => 7,
        'duration_min' => 30,
    ]);
});

function bookForMail(string $slug, string $serviceId, array $overrides = [])
{
    return test()->postJson("/api/v1/public/tenants/{$slug}/book", array_merge([
        'service_id' => $serviceId,
        'scheduled_at' => \Carbon\Carbon::tomorrow(config('app.timezone'))->setTime(9, 0)->format('Y-m-d H:i:s'),
        'client_name' => 'Sebastián Ruiz',
        'client_email' => 'sebastian@example.com',
        'client_phone' => '0999123456',
        'client_resource_data' => ['nombre' => 'Sebastián'],
    ], $overrides));
}

test('booking as a guest emails the customer their appointment', function () {
    bookForMail($this->tenant->slug, $this->service->id)->assertCreated();

    Mail::assertQueued(ReservationConfirmedMail::class, function ($mail) {
        return $mail->hasTo('sebastian@example.com');
    });
});

test('the email carries the business, the service and the local time', function () {
    bookForMail($this->tenant->slug, $this->service->id)->assertCreated();

    Mail::assertQueued(ReservationConfirmedMail::class, function (ReservationConfirmedMail $mail) {
        expect($mail->tenantName)->toBe('Peluquería Demo');
        expect($mail->servicesLabel)->toContain('Corte niños');
        // La hora que eligió el cliente, no la que quedó en UTC.
        expect($mail->scheduledAt->format('H:i'))->toBe('09:00');
        return true;
    });
});

test('the email carries a magic link that outlives the login one', function () {
    bookForMail($this->tenant->slug, $this->service->id)->assertCreated();

    $token = DB::table('magic_link_tokens')->where('email', 'sebastian@example.com')->first();
    expect($token)->not->toBeNull();
    // El correo de confirmación se abre cuando se abre: 15 minutos no alcanzan.
    expect(now()->diffInDays($token->expires_at, false))->toBeGreaterThan(1);

    Mail::assertQueued(ReservationConfirmedMail::class, function (ReservationConfirmedMail $mail) {
        expect($mail->magicUrl)->toContain('/m/');
        return true;
    });
});

test('the email says the booking still needs the shop to confirm it', function () {
    bookForMail($this->tenant->slug, $this->service->id)->assertCreated();

    Mail::assertQueued(ReservationConfirmedMail::class, function (ReservationConfirmedMail $mail) {
        expect($mail->isConfirmed)->toBeFalse();
        return true;
    });
});

test('a shop with auto-confirm says the appointment is already confirmed', function () {
    $this->tenant->update(['settings' => ['auto_confirm_reservations' => true]]);

    bookForMail($this->tenant->slug, $this->service->id)->assertCreated();

    Mail::assertQueued(ReservationConfirmedMail::class, function (ReservationConfirmedMail $mail) {
        expect($mail->isConfirmed)->toBeTrue();
        return true;
    });
});

test('nothing is sent to a placeholder address', function () {
    // El mostrador le inventa `nombre-XXXX@client.local` al walk-in. No es una
    // dirección: mandar ahí sólo ensucia la reputación del remitente.
    $ghost = UserModel::create([
        'name' => 'Walk In',
        'email' => 'walkin-1234@client.local',
        'password' => bcrypt('x'),
    ]);
    $this->actingAs($ghost, 'sanctum');

    bookForMail($this->tenant->slug, $this->service->id, [
        'client_name' => null,
        'client_email' => null,
        'client_phone' => null,
    ])->assertCreated();

    Mail::assertNotQueued(ReservationConfirmedMail::class);
});

/**
 * Con `Mail::fake()` la vista NUNCA se renderiza: los tests de arriba miran las
 * propiedades del mailable y pasan aunque la plantilla no compile. Así se fue a
 * staging una vista rota — un `@if` pegado a la palabra anterior, que Blade deja
 * como texto y cuyo `@endif` revienta el archivo entero. Esto la compila.
 */
test('the email renders, with and without the optional fields', function (?string $phone, ?string $address) {
    $mail = new ReservationConfirmedMail(
        tenantName: 'Peluquería Demo',
        servicesLabel: 'Corte niños',
        scheduledAt: new DateTime('2026-09-01 09:00:00'),
        durationMin: 30,
        isConfirmed: false,
        magicUrl: 'https://goturnly.com/m/' . str_repeat('a', 64),
        address: $address,
        phone: $phone,
    );

    $html = $mail->render();

    expect($html)->toContain('Corte niños');
    expect($html)->toContain('martes 1 de septiembre, 09:00');
    expect($html)->toContain('/m/' . str_repeat('a', 64));
    // Lo que quedaba suelto cuando la directiva no compilaba.
    expect($html)->not->toContain('@if');
    expect($html)->not->toContain('@endif');
})->with([
    'con dirección y teléfono' => ['0991213606', 'Av. Demo 100'],
    'sin nada opcional' => [null, null],
]);

test('the plain-text part renders too', function () {
    $mail = new ReservationConfirmedMail(
        tenantName: 'Peluquería Demo',
        servicesLabel: 'Corte niños',
        scheduledAt: new DateTime('2026-09-01 09:00:00'),
        durationMin: 30,
        isConfirmed: true,
        magicUrl: 'https://goturnly.com/m/abc',
    );

    $text = (string) $mail->render();
    expect($text)->not->toContain('@endif');
});
