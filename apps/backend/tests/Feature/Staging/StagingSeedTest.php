<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

/**
 * Phase 3 of docs/superpowers/specs/2026-08-26-staging-e2e-design.md.
 *
 * The command copies production's CONFIG from a committed fixture and invents
 * every person. What it must never do is run anywhere near production, so the
 * guards get tested first and hardest.
 */
it('refuses to run in production', function () {
    $this->app->detectEnvironment(fn () => 'production');

    $this->artisan('staging:seed')
        ->expectsOutputToContain('never in production')
        ->assertExitCode(1);

    expect(DB::table('tenants')->count())->toBe(0);
});

it('refuses to run against a database whose name smells of production', function () {
    // A whole connection rather than a purge of the live one: purging the
    // connection RefreshDatabase is holding a transaction on breaks every
    // test that runs after this file. Laravel connects lazily, so the guard
    // reads the name and aborts without ever opening the file.
    config([
        'database.connections.prodlike' => [
            'driver' => 'sqlite',
            'database' => '/tmp/turnly_prod.sqlite',
            'prefix' => '',
            'foreign_key_constraints' => false,
        ],
        'database.default' => 'prodlike',
    ]);

    $this->artisan('staging:seed')
        ->expectsOutputToContain('turnly_prod')
        ->assertExitCode(1);

    config(['database.default' => 'sqlite']);
});

it('loads the three tenants with production settings intact', function () {
    $this->artisan('staging:seed', ['--clients' => 4])->assertExitCode(0);

    $tenants = DB::table('tenants')->orderBy('slug')->get();
    expect($tenants)->toHaveCount(3)
        ->and($tenants->pluck('slug')->all())
        ->toBe(['autospa-demo', 'barberia-demo', 'negocio-demo']);

    // The permissions matrix is the whole point of copying config: test 3 of
    // the spec is a login that lands on prod's own matrix.
    $autospa = $tenants->firstWhere('slug', 'autospa-demo');
    $settings = json_decode($autospa->settings, true);
    expect($settings['permissions']['Cajero']['Caja'])->toBe('full')
        ->and($settings['permissions']['Lavador']['Registro'])->toBe('full')
        ->and($settings['iva_mode'])->toBe('included')
        ->and($settings['require_open_till_for_cash'])->toBeFalse();

    // The variant map drives vehicle-type matching, which is behaviour.
    $fields = json_decode($autospa->custom_fields, true);
    expect(collect($fields)->firstWhere('key', 'vehicle_type')['affects_variant'])->toBeTrue();

    expect(DB::table('services')->count())->toBe(21)
        ->and(DB::table('service_variants')->count())->toBe(44)
        ->and(DB::table('products')->count())->toBe(12)
        ->and(DB::table('service_variant_consumption')->count())->toBe(20)
        ->and(DB::table('service_staff')->count())->toBe(10);
});

it('carries no real person, business or bucket into staging', function () {
    $this->artisan('staging:seed', ['--clients' => 4])->assertExitCode(0);

    $blob = strtolower(json_encode([
        DB::table('tenants')->get(),
        DB::table('service_staff')->get(),
        DB::table('services')->get(),
    ]));

    foreach (['jirapintas', 'feder', '0991213606', 'r2.dev', 'pablo', 'azucena'] as $leak) {
        expect($blob)->not->toContain($leak);
    }
});

it('creates one login per role in every tenant, with the email already verified', function () {
    $this->artisan('staging:seed', ['--clients' => 4])->assertExitCode(0);

    $admin = DB::table('users')->where('email', 'admin@autospa-demo.staging.goturnly.com')->first();
    expect($admin)->not->toBeNull()
        // Staff with a null email_verified_at get 403'd by verified.email
        // everywhere, which reads as an empty app. Learned on 2026-08-01.
        ->and($admin->email_verified_at)->not->toBeNull();

    $roles = DB::table('tenant_users')
        ->join('users', 'users.id', '=', 'tenant_users.user_id')
        ->where('users.email', 'like', '%@autospa-demo.%')
        ->where('tenant_users.role', '!=', 'Cliente')
        ->pluck('tenant_users.role')
        ->sort()->values()->all();

    // Exactly the roles autospa's own matrix names, minus Cliente.
    expect($roles)->toBe(['Admin', 'Cajero', 'Lavador']);

    // The clients are in the same tenant, under the role that gets nothing.
    expect(DB::table('tenant_users')
        ->join('users', 'users.id', '=', 'tenant_users.user_id')
        ->where('users.email', 'like', 'cliente%@autospa-demo.%')
        ->where('tenant_users.role', 'Cliente')
        ->count())->toBe(4);
});

it('invents clients, vehicles, service logs and the payments behind them', function () {
    $this->artisan('staging:seed', ['--clients' => 6])->assertExitCode(0);

    expect(DB::table('client_resources')->count())->toBeGreaterThan(0)
        ->and(DB::table('service_logs')->count())->toBeGreaterThan(0)
        ->and(DB::table('service_log_items')->count())->toBeGreaterThan(0)
        ->and(DB::table('service_log_events')->count())->toBeGreaterThan(0)
        ->and(DB::table('reservations')->count())->toBeGreaterThan(0)
        ->and(DB::table('payments')->count())->toBeGreaterThan(0);

    // A payment with no allocation is the orphan that broke the till on
    // 2026-08-24. Synthetic data must not seed the same shape.
    $orphans = DB::table('payments')
        ->leftJoin('payment_allocations', 'payment_allocations.payment_id', '=', 'payments.id')
        ->whereNull('payment_allocations.id')
        ->count();
    expect($orphans)->toBe(0);

    // Every paid log must add up to what was collected for it.
    $log = DB::table('service_logs')->where('payment_status', 'paid')->first();
    $collected = DB::table('payment_allocations')
        ->where('payable_id', $log->id)
        ->sum('amount');
    expect((float) $collected)->toBe((float) $log->price_charged);
});

it('is idempotent: a second run changes no counts', function () {
    $this->artisan('staging:seed', ['--clients' => 4])->assertExitCode(0);

    $before = collect(['tenants', 'services', 'service_variants', 'products', 'users',
        'client_resources', 'service_logs', 'reservations', 'payments'])
        ->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()]);

    $this->artisan('staging:seed', ['--clients' => 4])->assertExitCode(0);

    $after = $before->keys()->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()]);

    expect($after->all())->toBe($before->all());
});

it('never reaches for a factory or faker, which staging does not have', function () {
    // composer install --no-dev on the staging box leaves fakerphp/faker out,
    // so anything the command touches through a factory explodes there while
    // the whole suite stays green here. Verified absent on the box 2026-08-27.
    $source = file_get_contents(app_path('Infrastructure/Console/Commands/StagingSeedCommand.php'));

    expect($source)->not->toContain('::factory(')
        ->and($source)->not->toContain('fake(')
        ->and($source)->not->toContain('Faker');
});
