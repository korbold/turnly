<?php

declare(strict_types=1);

namespace App\Infrastructure\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * Phase 3 of docs/superpowers/specs/2026-08-26-staging-e2e-design.md.
 *
 * Two halves, and the split is the whole idea:
 *
 *  - CONFIG comes from database/seeders/staging/config.json, a fixture derived
 *    once from production. It is what changes how the system behaves — the
 *    permissions matrix, iva_mode, payment_timing, the variant map, prices,
 *    recipes — so copying it is what makes a bug show up here instead of on a
 *    Monday morning.
 *  - PEOPLE are invented. No name, phone, plate, email or tax id of a real
 *    person or business crosses into staging, and the fixture carries none
 *    either: the names in it were replaced when it was generated.
 *
 * No factories and no faker on purpose. The staging box installs with
 * `composer install --no-dev`, so fakerphp/faker is simply not there —
 * verified absent on the box 2026-08-27. A factory would work in the test
 * suite and die on the only machine this command is meant for.
 *
 * The billing side is NOT seeded here, and that is deliberate. `ambiente`
 * lives in the billing service's own database (turnly_billing.
 * tenant_billing_configs) next to p12_cert and p12_password, and production
 * has one tenant sitting at ambiente=2. Copying that row would put a real
 * signing certificate on a sandbox. Staging's billing config gets created
 * fresh, at ambiente=1, with its own test certificate.
 */
final class StagingSeedCommand extends Command
{
    protected $signature = 'staging:seed
        {--clients=20 : synthetic clients to invent per tenant}';

    protected $description = "Load production's config from the committed fixture and invent every person on top of it";

    /** Printed at the end. Staging is a sandbox; the password is not a secret. */
    private const STAFF_PASSWORD = 'staging1234';

    /**
     * Tenant-scoped config, keyed by id. The fixture's ids are its own — they
     * were rewritten when it was generated, so no production id reaches here.
     */
    private const CONFIG_TABLES = [
        'services', 'service_variants', 'products',
        'service_variant_consumption', 'business_resources', 'service_staff',
    ];

    /**
     * Global catalogues, keyed by slug instead. The create_business_categories
     * migration inserts the six categories itself, with ids minted on the box,
     * so an upsert by id collides on the unique slug. Matching on slug also
     * means the fixture cannot fork a second "Car Wash".
     */
    private const CATALOGUE_TABLES = ['plans', 'business_categories'];

    /**
     * The matrix names roles one way and the database stores them another.
     * `tenant_users.role` holds a CODE, and the admin panel gates its whole
     * nav on it: usePermissions treats 'cashier' and 'washer' as restricted
     * and reads the matrix for them, while anything it does not recognise
     * falls through to full access. Seeding 'Cajero' therefore produced a
     * cashier who could see Equipo, Config and Plan — sections the matrix
     * denies. Found by logging into staging on 2026-08-27; production stores
     * tenant_admin, cashier and client.
     */
    private const ROLE_CODES = [
        'Admin' => 'tenant_admin',
        'Cajero' => 'cashier',
        'Lavador' => 'washer',
        'Cliente' => 'client',
    ];

    /** Invented. Any resemblance to a real customer would defeat the point. */
    private const CLIENT_NAMES = [
        'Aurora Benitez', 'Ciro Delgado', 'Elena Fajardo', 'Gaspar Herrera',
        'Ines Jaramillo', 'Kevin Lara', 'Mora Nieto', 'Olga Pazmino',
        'Quique Rueda', 'Sara Tinajero', 'Ulises Vaca', 'Wendy Yepez',
        'Abel Zurita', 'Bruna Coba', 'Cesar Duran', 'Dafne Espin',
        'Elias Freire', 'Fabiola Gomez', 'Gonzalo Ibarra', 'Hilda Jurado',
    ];

    private const PLATE_LETTERS = ['IBA', 'PCX', 'GSK', 'ABM', 'TDR'];

    private const CAR_BRANDS = [
        ['Chevrolet', 'Aveo', 'sedan', 'Sedán'],
        ['Toyota', 'Hilux', 'pickup', 'Camioneta'],
        ['Kia', 'Sportage', 'suv', 'SUV'],
        ['Hyundai', 'Accent', 'sedan', 'Sedán'],
        ['Nissan', 'Versa', 'sedan', 'Hatchback'],
    ];

    private const COLORS = ['Blanco', 'Negro', 'Gris', 'Rojo', 'Azul'];

    public function handle(): int
    {
        if (! $this->safeToRun()) {
            return self::FAILURE;
        }

        $config = $this->fixture();

        DB::transaction(function () use ($config) {
            $this->importConfig($config);
            $this->inventPeople($config);
        });

        $this->summary();

        return self::SUCCESS;
    }

    /**
     * Both guards exist because of the same imagined accident: this command,
     * pointed at the wrong database. The environment check catches a careless
     * deploy; the database-name check catches a careless .env, which is the
     * one that would delete real work.
     */
    private function safeToRun(): bool
    {
        if (app()->environment('production')) {
            $this->error('staging:seed runs never in production. Nothing was written.');

            return false;
        }

        $database = (string) DB::connection()->getDatabaseName();

        if (preg_match('/prod/i', $database) === 1) {
            $this->error("staging:seed refuses to touch {$database}: that name reads as production. Nothing was written.");

            return false;
        }

        return true;
    }

    /** @return array<string, list<array<string, mixed>>> */
    private function fixture(): array
    {
        $path = database_path('seeders/staging/config.json');

        if (! is_file($path)) {
            throw new RuntimeException("The staging fixture is missing at {$path}.");
        }

        /** @var array<string, list<array<string, mixed>>> $config */
        $config = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);

        return $config;
    }

    /**
     * Upsert by primary key, so a second run overwrites instead of duplicating
     * and a config change in the fixture lands without wiping the synthetic
     * clients, reservations and till history sitting on top of it.
     *
     * @param  array<string, list<array<string, mixed>>>  $config
     */
    private function importConfig(array $config): void
    {
        $remap = [];

        foreach (self::CATALOGUE_TABLES as $table) {
            $remap += $this->importCatalogue($table, $config[$table] ?? []);
        }

        // A plan the box already had keeps its own id, so every tenant has to
        // be pointed at that one rather than at the fixture's.
        $tenants = array_map(function (array $tenant) use ($remap): array {
            $tenant['plan_id'] = $remap[$tenant['plan_id']] ?? $tenant['plan_id'];

            return $this->flatten($tenant);
        }, $config['tenants']);

        DB::table('tenants')->upsert(
            $tenants,
            ['id'],
            array_diff(array_keys($tenants[0]), ['id'])
        );
        $this->line(sprintf('  config %-28s %d', 'tenants', count($tenants)));

        foreach (self::CONFIG_TABLES as $table) {
            $rows = array_map($this->flatten(...), $config[$table] ?? []);

            if ($rows === []) {
                continue;
            }

            $columns = array_keys($rows[0]);

            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table($table)->upsert($chunk, ['id'], array_diff($columns, ['id']));
            }

            $this->line(sprintf('  config %-28s %d', $table, count($rows)));
        }
    }

    /**
     * Match on slug, keep whatever id the row already has, and report the
     * mapping so foreign keys in the fixture can follow.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, string> fixture id => id actually stored
     */
    private function importCatalogue(string $table, array $rows): array
    {
        $mapping = [];

        foreach ($rows as $row) {
            $row = $this->flatten($row);
            $existing = DB::table($table)->where('slug', $row['slug'])->value('id');

            if ($existing !== null) {
                $mapping[(string) $row['id']] = (string) $existing;
                unset($row['id']);
                DB::table($table)->where('id', $existing)->update($row);

                continue;
            }

            $mapping[(string) $row['id']] = (string) $row['id'];
            DB::table($table)->insert($row);
        }

        $this->line(sprintf('  config %-28s %d', $table, count($rows)));

        return $mapping;
    }

    /**
     * A JSON column read straight off the fixture is already an array, while
     * the same column read back out of the database is a string. Both shapes
     * reach these methods.
     *
     * @return array<string, mixed>|list<mixed>
     */
    private function asArray(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        return json_decode((string) ($value ?? ''), true) ?: [];
    }

    /**
     * JSON columns arrive from the fixture already decoded, and booleans as
     * true/false. The query builder wants a string and an int.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function flatten(array $row): array
    {
        foreach ($row as $key => $value) {
            if (is_array($value)) {
                $row[$key] = json_encode($value, JSON_UNESCAPED_UNICODE);
            } elseif (is_bool($value)) {
                $row[$key] = (int) $value;
            }
        }

        return $row;
    }

    /** @param array<string, list<array<string, mixed>>> $config */
    private function inventPeople(array $config): void
    {
        $perTenant = max(1, (int) $this->option('clients'));

        foreach ($config['tenants'] as $tenant) {
            $slug = (string) $tenant['slug'];
            $staff = $this->staffFor($tenant);
            $catalogue = $this->catalogueFor($config, (string) $tenant['id']);

            $clients = $this->clientsFor($tenant, $perTenant);
            $resources = $this->resourcesFor($tenant, $clients);

            $logs = $this->serviceLogsFor($tenant, $staff, $catalogue, $resources);
            $this->reservationsFor($tenant, $staff, $catalogue, $resources);

            $this->line(sprintf(
                '  people %-28s %d staff, %d clients, %d resources, %d logs',
                $slug, count($staff), count($clients), count($resources), $logs
            ));
        }
    }

    /**
     * One login per role the tenant's own matrix knows about, minus Cliente.
     * The matrix is 100% frontend, so the roles it names are exactly the ones
     * worth being able to log in as.
     *
     * @param  array<string, mixed>  $tenant
     * @return array<string, string> role => user id
     */
    private function staffFor(array $tenant): array
    {
        $settings = $this->asArray($tenant['settings'] ?? null);
        $roles = array_values(array_diff(array_keys($settings['permissions'] ?? []), ['Cliente']));

        if ($roles === []) {
            $roles = ['Admin', 'Cajero'];
        }

        sort($roles);
        $slug = (string) $tenant['slug'];
        $staff = [];

        foreach ($roles as $role) {
            $id = $this->id("user:{$slug}:{$role}");

            $this->upsertUser([
                'id' => $id,
                'name' => "{$role} Demo",
                'email' => strtolower($role)."@{$slug}.staging.goturnly.com",
                'phone' => '0999000000',
            ]);

            DB::table('tenant_users')->upsert([[
                'id' => $this->id("tenant_user:{$slug}:{$role}"),
                'tenant_id' => $tenant['id'],
                'user_id' => $id,
                'role' => self::ROLE_CODES[$role] ?? strtolower($role),
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]], ['id'], ['role', 'is_active', 'updated_at']);

            $staff[$role] = $id;
        }

        return $staff;
    }

    /**
     * @param  array<string, mixed>  $tenant
     * @return list<string> client user ids
     */
    private function clientsFor(array $tenant, int $count): array
    {
        $slug = (string) $tenant['slug'];
        $ids = [];

        for ($i = 1; $i <= $count; $i++) {
            $id = $this->id("client:{$slug}:{$i}");

            $this->upsertUser([
                'id' => $id,
                'name' => self::CLIENT_NAMES[($i - 1) % count(self::CLIENT_NAMES)],
                'email' => "cliente{$i}@{$slug}.staging.goturnly.com",
                'phone' => '09990'.str_pad((string) $i, 5, '0', STR_PAD_LEFT),
            ]);

            DB::table('tenant_users')->upsert([[
                'id' => $this->id("tenant_user:{$slug}:client:{$i}"),
                'tenant_id' => $tenant['id'],
                'user_id' => $id,
                'role' => self::ROLE_CODES['Cliente'],
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]], ['id'], ['role', 'is_active', 'updated_at']);

            $ids[] = $id;
        }

        return $ids;
    }

    /** @param array<string, mixed> $user */
    private function upsertUser(array $user): void
    {
        DB::table('users')->upsert([[
            ...$user,
            'is_super_admin' => 0,
            // A staff account with a null email_verified_at is refused by
            // verified.email everywhere, which looks like an empty app.
            'email_verified_at' => now(),
            'terms_accepted_at' => now(),
            'password' => Hash::make(self::STAFF_PASSWORD),
            'created_by_walkin' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]], ['id'], ['name', 'email', 'phone', 'email_verified_at', 'updated_at']);
    }

    /**
     * The vehicle (or person) a client brings in. Prod keeps this in the `data`
     * JSON column shaped by the tenant's own custom_fields; the flat
     * plate/brand/model/color columns next to it are dead — NULL in all 268
     * production rows — so they stay NULL here too.
     *
     * @param  array<string, mixed>  $tenant
     * @param  list<string>  $clients
     * @return list<array{id: string, client_id: string}>
     */
    private function resourcesFor(array $tenant, array $clients): array
    {
        $slug = (string) $tenant['slug'];
        $fields = $this->asArray($tenant['custom_fields'] ?? null);
        $keys = array_column($fields, 'key');
        $vehicular = in_array('plate', $keys, true);
        $resources = [];

        foreach ($clients as $index => $clientId) {
            // Every fourth client owns two, because a client with several
            // vehicles is where the picker used to break.
            $owned = $index % 4 === 3 ? 2 : 1;

            for ($n = 1; $n <= $owned; $n++) {
                $id = $this->id("resource:{$slug}:{$index}:{$n}");
                $seed = $index + $n;

                if ($vehicular) {
                    [$brand, $model, $type, $vehicleType] = self::CAR_BRANDS[$seed % count(self::CAR_BRANDS)];
                    $data = [
                        'plate' => self::PLATE_LETTERS[$seed % count(self::PLATE_LETTERS)]
                            .str_pad((string) (1000 + $seed * 7), 4, '0', STR_PAD_LEFT),
                        'brand' => $brand,
                        'model' => $model,
                        'color' => self::COLORS[$seed % count(self::COLORS)],
                        'vehicle_type' => $vehicleType,
                    ];
                } else {
                    $type = 'other';
                    $data = [
                        'nombre' => self::CLIENT_NAMES[$index % count(self::CLIENT_NAMES)],
                        'telefono' => '09990'.str_pad((string) ($index + 1), 5, '0', STR_PAD_LEFT),
                    ];
                }

                DB::table('client_resources')->upsert([[
                    'id' => $id,
                    'tenant_id' => $tenant['id'],
                    'client_id' => $clientId,
                    'data' => json_encode($data, JSON_UNESCAPED_UNICODE),
                    'type' => $type,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]], ['id'], ['data', 'type', 'updated_at']);

                $resources[] = ['id' => $id, 'client_id' => $clientId];
            }
        }

        return $resources;
    }

    /**
     * @param  array<string, list<array<string, mixed>>>  $config
     * @return array{services: list<array<string, mixed>>, variants: array<string, list<array<string, mixed>>>, products: list<array<string, mixed>>, washers: list<string>, dryers: list<string>}
     */
    private function catalogueFor(array $config, string $tenantId): array
    {
        $mine = fn (string $table) => array_values(array_filter(
            $config[$table],
            fn (array $row) => $row['tenant_id'] === $tenantId
        ));

        $variants = [];
        foreach ($mine('service_variants') as $variant) {
            $variants[(string) $variant['service_id']][] = $variant;
        }

        $staff = $mine('service_staff');

        return [
            'services' => array_values(array_filter($mine('services'), fn ($s) => (bool) $s['is_active'])),
            'variants' => $variants,
            'products' => $mine('products'),
            'washers' => array_column(array_filter($staff, fn ($s) => $s['position'] === 'washer'), 'id'),
            'dryers' => array_column(array_filter($staff, fn ($s) => $s['position'] === 'dryer'), 'id'),
        ];
    }

    /**
     * Walk-in work: a service log per client, with its lines, its append-only
     * event trail, and the money actually collected for it. The mix is
     * deliberate — paid, unpaid and partial all appear, because a partial that
     * looked unpaid is what let a payment go orphan on 2026-08-24.
     *
     * @param  array<string, mixed>  $tenant
     * @param  array<string, string>  $staff
     * @param  array{services: list<array<string, mixed>>, variants: array<string, list<array<string, mixed>>>, products: list<array<string, mixed>>, washers: list<string>, dryers: list<string>}  $catalogue
     * @param  list<array{id: string, client_id: string}>  $resources
     */
    private function serviceLogsFor(array $tenant, array $staff, array $catalogue, array $resources): int
    {
        if ($catalogue['services'] === [] || $resources === []) {
            return 0;
        }

        $slug = (string) $tenant['slug'];
        $attendant = $staff['Cajero'] ?? $staff['Admin'] ?? reset($staff);
        $written = 0;

        foreach ($resources as $index => $resource) {
            $service = $catalogue['services'][$index % count($catalogue['services'])];
            $variants = $catalogue['variants'][(string) $service['id']] ?? [];
            $variant = $variants === [] ? null : $variants[$index % count($variants)];

            $unitPrice = (float) ($variant['price'] ?? $service['price'] ?? 0.0);
            $unitPrice = $unitPrice > 0 ? $unitPrice : 8.0;
            $duration = (int) ($variant['duration_min'] ?? 30);

            $id = $this->id("log:{$slug}:{$index}");
            $startedAt = Carbon::today()->subDays($index % 18)->setTime(8 + ($index % 9), ($index % 4) * 15);

            // paid, paid, unpaid, partial — in that proportion.
            $paymentStatus = ['paid', 'paid', 'unpaid', 'partial'][$index % 4];
            $method = ['cash', 'card', 'transfer'][$index % 3];

            $lines = [[
                'id' => $this->id("log_item:{$slug}:{$index}:service"),
                'tenant_id' => $tenant['id'],
                'service_log_id' => $id,
                'item_type' => 'service_variant',
                'ref_id' => $variant['id'] ?? $service['id'],
                'label' => (string) $service['name'].($variant ? ' — '.$variant['label'] : ''),
                'qty' => 1,
                'unit_price' => $unitPrice,
                'catalog_price' => $unitPrice,
                'line_total' => $unitPrice,
                'sort_order' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]];

            // Every third ticket also sells something off the shelf, which is
            // the shape that used to come back as a service and break the FK.
            if ($catalogue['products'] !== [] && $index % 3 === 0) {
                $product = $catalogue['products'][$index % count($catalogue['products'])];
                $price = (float) ($product['price'] ?? 0.0) ?: 2.5;

                $lines[] = [
                    'id' => $this->id("log_item:{$slug}:{$index}:product"),
                    'tenant_id' => $tenant['id'],
                    'service_log_id' => $id,
                    'item_type' => 'product',
                    'ref_id' => $product['id'],
                    'label' => (string) $product['name'],
                    'qty' => 1,
                    'unit_price' => $price,
                    'catalog_price' => $price,
                    'line_total' => $price,
                    'sort_order' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            $charged = round(array_sum(array_column($lines, 'line_total')), 2);
            $needsStaff = $service['staffing'] !== 'none';

            DB::table('service_logs')->upsert([[
                'id' => $id,
                'tenant_id' => $tenant['id'],
                'client_resource_id' => $resource['id'],
                'service_id' => $service['id'],
                'service_variant_id' => $variant['id'] ?? null,
                'attended_by' => $attendant,
                'washed_by' => $needsStaff && $catalogue['washers'] !== []
                    ? $catalogue['washers'][$index % count($catalogue['washers'])] : null,
                'dried_by' => $needsStaff && $service['staffing'] === 'washer_dryer' && $catalogue['dryers'] !== []
                    ? $catalogue['dryers'][$index % count($catalogue['dryers'])] : null,
                'created_by' => $attendant,
                'started_at' => $startedAt,
                'finished_at' => $startedAt->copy()->addMinutes($duration),
                'price_charged' => $charged,
                'payment_method' => $paymentStatus === 'unpaid' ? null : $method,
                'payment_status' => $paymentStatus,
                'left_owing' => $paymentStatus === 'unpaid' ? 1 : 0,
                'paid_at' => $paymentStatus === 'unpaid' ? null : $startedAt->copy()->addMinutes($duration + 5),
                'invoiced' => 0,
                'status' => 'completed',
                'log_date' => $startedAt->toDateString(),
                'created_at' => $startedAt,
                'updated_at' => now(),
            ]], ['id'], ['price_charged', 'payment_status', 'payment_method', 'left_owing', 'paid_at', 'updated_at']);

            DB::table('service_log_items')->upsert($lines, ['id'], ['label', 'unit_price', 'line_total', 'updated_at']);
            $this->trailFor($tenant, $id, $attendant, $startedAt, $paymentStatus, count($lines) > 1);

            if ($paymentStatus !== 'unpaid') {
                $collected = $paymentStatus === 'partial' ? round($charged / 2, 2) : $charged;
                $this->collect($tenant, $id, $resource['client_id'], $attendant, $collected, $method, $startedAt, $index);
            }

            $written++;
        }

        return $written;
    }

    /**
     * The append-only trail. Eight events exist in the real thing; the three
     * seeded here are the ones every ticket goes through.
     *
     * @param  array<string, mixed>  $tenant
     */
    private function trailFor(array $tenant, string $logId, string $userId, Carbon $at, string $paymentStatus, bool $hasProduct): void
    {
        $events = [['created', $at]];

        if ($hasProduct) {
            $events[] = ['items_changed', $at->copy()->addMinutes(3)];
        }

        $events[] = ['status_changed', $at->copy()->addMinutes(20)];

        if ($paymentStatus !== 'unpaid') {
            $events[] = ['payment_recorded', $at->copy()->addMinutes(25)];
        } else {
            $events[] = ['left_owing', $at->copy()->addMinutes(25)];
        }

        $rows = [];
        foreach ($events as $n => [$event, $when]) {
            $rows[] = [
                'id' => $this->id("event:{$logId}:{$n}"),
                'tenant_id' => $tenant['id'],
                'service_log_id' => $logId,
                'event' => $event,
                'detail' => null,
                'changed_by_user_id' => $userId,
                'changed_at' => $when,
            ];
        }

        DB::table('service_log_events')->upsert($rows, ['id'], ['event', 'changed_at']);
    }

    /**
     * A payment and the allocation that ties it to the ticket. Never one
     * without the other: a payment with no allocation is the orphan that made
     * a till impossible to read.
     *
     * @param  array<string, mixed>  $tenant
     */
    private function collect(array $tenant, string $logId, string $clientId, string $receivedBy, float $amount, string $method, Carbon $at, int $index): void
    {
        $paymentId = $this->id("payment:{$logId}");

        DB::table('payments')->upsert([[
            'id' => $paymentId,
            'tenant_id' => $tenant['id'],
            'client_id' => $clientId,
            'amount' => $amount,
            'method' => $method,
            'bank' => $method === 'transfer' ? 'Banco Demo' : null,
            'paid_at' => $at->copy()->addMinutes(25),
            'received_by' => $receivedBy,
            'created_at' => $at,
            'updated_at' => now(),
        ]], ['id'], ['amount', 'method', 'bank', 'paid_at', 'updated_at']);

        DB::table('payment_allocations')->upsert([[
            'id' => $this->id("allocation:{$logId}"),
            'tenant_id' => $tenant['id'],
            'payment_id' => $paymentId,
            'payable_type' => 'service_log',
            'payable_id' => $logId,
            'amount' => $amount,
            'created_at' => $at,
            'updated_at' => now(),
        ]], ['id'], ['amount', 'updated_at']);
    }

    /**
     * Booked work, spread across the calendar so the agenda has something to
     * draw both behind and ahead of today.
     *
     * @param  array<string, mixed>  $tenant
     * @param  array<string, string>  $staff
     * @param  array{services: list<array<string, mixed>>, variants: array<string, list<array<string, mixed>>>, products: list<array<string, mixed>>, washers: list<string>, dryers: list<string>}  $catalogue
     * @param  list<array{id: string, client_id: string}>  $resources
     */
    private function reservationsFor(array $tenant, array $staff, array $catalogue, array $resources): void
    {
        if ($catalogue['services'] === [] || $resources === []) {
            return;
        }

        $slug = (string) $tenant['slug'];
        $creator = $staff['Cajero'] ?? $staff['Admin'] ?? reset($staff);
        $statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

        foreach ($resources as $index => $resource) {
            if ($index % 2 === 1) {
                continue;
            }

            $service = $catalogue['services'][$index % count($catalogue['services'])];
            $variants = $catalogue['variants'][(string) $service['id']] ?? [];
            $variant = $variants === [] ? null : $variants[$index % count($variants)];
            $duration = (int) ($variant['duration_min'] ?? 30);

            // Half behind today, half ahead.
            $scheduledAt = Carbon::today()->addDays(($index % 12) - 5)->setTime(9 + ($index % 8), ($index % 2) * 30);
            $status = $statuses[$index % count($statuses)];

            DB::table('reservations')->upsert([[
                'id' => $this->id("reservation:{$slug}:{$index}"),
                'tenant_id' => $tenant['id'],
                'client_id' => $resource['client_id'],
                'client_resource_id' => $resource['id'],
                'service_id' => $service['id'],
                'service_variant_id' => $variant['id'] ?? null,
                'scheduled_at' => $scheduledAt,
                'estimated_end' => $scheduledAt->copy()->addMinutes($duration),
                'status' => $status,
                'cancelled_at' => $status === 'cancelled' ? $scheduledAt->copy()->subHours(2) : null,
                'cancel_reason' => $status === 'cancelled' ? 'El cliente no pudo llegar' : null,
                'created_by' => $creator,
                'payment_status' => $status === 'completed' ? 'paid' : 'unpaid',
                'payment_method' => $status === 'completed' ? 'cash' : null,
                'paid_at' => $status === 'completed' ? $scheduledAt->copy()->addMinutes($duration) : null,
                'invoiced' => 0,
                'created_at' => $scheduledAt->copy()->subDays(1),
                'updated_at' => now(),
            ]], ['id'], ['scheduled_at', 'estimated_end', 'status', 'payment_status', 'updated_at']);
        }
    }

    /**
     * Deterministic ids, so a second run overwrites its own rows instead of
     * piling a second copy of staging on top of the first.
     */
    private function id(string $key): string
    {
        $hash = md5('turnly-staging-seed:'.$key);

        return substr($hash, 0, 8).'-'.substr($hash, 8, 4).'-5'.substr($hash, 13, 3)
            .'-8'.substr($hash, 17, 3).'-'.substr($hash, 20, 12);
    }

    private function summary(): void
    {
        $this->newLine();
        $this->info('Staging seeded.');
        $this->line('  Logins: {admin,cajero,lavador}@<slug>.staging.goturnly.com — password '.self::STAFF_PASSWORD);
        $this->line('  Tenants: autospa-demo (car_wash), barberia-demo (barbershop), negocio-demo (car_wash)');
        $this->newLine();
        $this->warn('Billing was NOT seeded. Create each tenant_billing_config by hand at ambiente=1');
        $this->warn('with a test certificate. Production has a tenant at ambiente=2, and that row');
        $this->warn('carries its real p12 certificate and password — it must never be copied here.');
    }
}
