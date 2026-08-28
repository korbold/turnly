<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\DB;

/**
 * La reparación de los 29 servicios que el purge dejó sin vehículo. Los datos
 * salen del binlog y son de dos locales reales, así que el test los usa tal
 * cual: un tenant con el id de FEDER y el par (servicio, vehículo) que de
 * verdad estaban enlazados el 26 de agosto.
 */
const FEDER      = '019e8593-ec52-733e-b25e-8ad226e08146';
const LOG_ID     = '01a03ef2-15cd-7016-b554-cabb7c2ce865';
const VEHICLE_ID = '01a03e39-ae1d-7184-a346-e9dbf21e9be9';

function runRestorePurged(): void
{
    $migration = require base_path('database/migrations/2026_08_28_100002_restore_purged_client_resources.php');
    $migration->up();
}

function seedOrphanLog(?string $resourceId = null): void
{
    $tenant = TenantModel::factory()->create(['id' => FEDER, 'status' => 'active', 'business_type' => 'car_wash']);
    $staff  = UserModel::factory()->create();

    ServiceLogModel::factory()->create([
        'id'                 => LOG_ID,
        'tenant_id'          => $tenant->id,
        'client_resource_id' => $resourceId,
        'service_id'         => ServiceModel::factory()->create(['tenant_id' => $tenant->id])->id,
        'attended_by'        => $staff->id,
        'created_by'         => $staff->id,
    ]);
}

test('brings the vehicle back and re-points the service', function () {
    seedOrphanLog();

    runRestorePurged();

    $resource = ClientResourceModel::withoutGlobalScopes()->find(VEHICLE_ID);

    expect($resource)->not->toBeNull()
        ->and($resource->data['plate'])->toBe('PBW6214')
        ->and($resource->data['nombre'])->toBe('Gaby Arellano')
        // El dueño no vuelve: la cuenta se borró y el nombre vive en `data`.
        ->and($resource->client_id)->toBeNull()
        ->and(ServiceLogModel::withoutGlobalScopes()->find(LOG_ID)->client_resource_id)->toBe(VEHICLE_ID);
});

test('runs twice without duplicating anything', function () {
    seedOrphanLog();

    runRestorePurged();
    runRestorePurged();

    expect(DB::table('client_resources')->where('id', VEHICLE_ID)->count())->toBe(1);
});

// Alguien pudo haberle asignado el vehículo a mano con "Asignar vehículo"
// antes de que esto corriera. Esa decisión la tomó una persona mirando el
// caso; la migración no la pisa.
test('never overwrites a vehicle assigned by hand', function () {
    $tenant = TenantModel::factory()->create(['id' => FEDER, 'status' => 'active', 'business_type' => 'car_wash']);
    $staff  = UserModel::factory()->create();
    $aMano  = ClientResourceModel::factory()->create(['tenant_id' => $tenant->id, 'data' => ['placa' => 'OTRA123']]);

    ServiceLogModel::factory()->create([
        'id'                 => LOG_ID,
        'tenant_id'          => $tenant->id,
        'client_resource_id' => $aMano->id,
        'service_id'         => ServiceModel::factory()->create(['tenant_id' => $tenant->id])->id,
        'attended_by'        => $staff->id,
        'created_by'         => $staff->id,
    ]);

    runRestorePurged();

    expect(ServiceLogModel::withoutGlobalScopes()->find(LOG_ID)->client_resource_id)->toBe($aMano->id);
});

// La base de un local que no es FEDER no tiene por qué conocer estos ids, y
// el insert reventaría contra la foránea del tenant.
test('does nothing where those tenants do not exist', function () {
    runRestorePurged();

    expect(DB::table('client_resources')->where('id', VEHICLE_ID)->exists())->toBeFalse();
});
