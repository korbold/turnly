<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Le devuelve el vehículo a los 29 servicios que lo perdieron por el purge.
 *
 * `users:purge-unverified` borraba en duro al cliente del mostrador a las 24h
 * y `client_resources.client_id` era ON DELETE CASCADE, así que el auto se iba
 * con él y el servicio quedaba en "Sin recurso". La fila del vehículo no tiene
 * soft delete: está borrada, no marcada.
 *
 * Se recuperó del binlog de MySQL (formato ROW, retención de 30 días), que
 * guarda la imagen completa de cada fila insertada. Dos lecturas:
 *
 *   1. el INSERT de cada `service_logs` huérfano, que trae el
 *      `client_resource_id` que tenía al nacer;
 *   2. el INSERT de ese `client_resources`, que trae la placa, la marca, el
 *      modelo y el nombre que escribió el mostrador.
 *
 * No es reconstrucción ni adivinanza: es el dato original, con su id y su
 * fecha de creación. Los borrados en cascada NO se registran en el binlog, así
 * que el borrado no dejó rastro — pero el alta sí, y con eso alcanza.
 *
 * `client_id` vuelve en NULL a propósito. El usuario que era dueño ya no
 * existe y resucitarlo sería inventar una cuenta; el nombre que dio la persona
 * vive dentro de `data.nombre`, que es de donde lo lee la pantalla. Un
 * vehículo sin dueño conocido es un walk-in, igual que después de `release()`.
 *
 * Cuatro huérfanos no están acá: nacieron sin vehículo y así se quedan. Son
 * ventas de mostrador —sólo producto— y ésas van sueltas por diseño.
 */
return new class extends Migration
{
    /**
     * id del vehículo => [tenant_id, data (json), created_at].
     *
     * @var array<string, array{0: string, 1: string, 2: string}>
     */
    private const RESOURCES = [
        '019fc448-9a0c-71b4-bcef-a78753eaaef8' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "JMC", "color": "Blanco/Verde", "plate": "IAI3592", "vehicle_type": "Camión / Van"}', '2026-08-02 16:02:00'],
        '01a00fea-4d6f-728b-ac96-950ff2646033' => ['019e1f1b-de88-72c9-a542-da2d899ab3d0', '{"brand": "Byd", "color": "Blanco", "model": "Yaun", "plate": "IBF-6060", "nombre": "Pedro Granja", "vehicle_type": "Hatchback"}', '2026-08-17 08:30:08'],
        '01a01501-3afc-7353-9bc1-b5cb0f3f0cae' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Toyota", "color": "Plomo", "model": "Yaris", "plate": "In galo prefectura", "nombre": "Ing Galo Prefectura", "vehicle_type": "Sedán"}', '2026-08-18 08:13:17'],
        '01a01a49-80c1-7303-aa42-fb1b1a53dfd4' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Aveo", "color": "Blanco", "plate": "IBC4687", "nombre": "Feder-Caja", "vehicle_type": "Sedán"}', '2026-08-19 08:50:19'],
        '01a01a54-593f-7242-981b-5523a9d9f037' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Chevrolet", "color": "Blanco", "model": "Aveo Family", "plate": "IBC4678", "vehicle_type": "Sedán"}', '2026-08-19 09:02:10'],
        '01a029b1-dfd9-73ea-b291-d8395f75fec7' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Kia", "color": "Negro", "model": "Sportage", "plate": "PCC7286", "nombre": "Gaby Arellano", "vehicle_type": "SUV"}', '2026-08-22 08:38:38'],
        '01a029b4-de68-700c-88b9-c16181afb6c4' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Glory", "color": "Rojo", "plate": "IBE3469", "nombre": "Gaby Arellano", "vehicle_type": "SUV"}', '2026-08-22 08:41:54'],
        '01a03533-3ec7-707c-8fca-be05bf286b5c' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Jeep", "color": "Negro", "plate": "MBF", "nombre": "Issac", "vehicle_type": "Sedán"}', '2026-08-24 14:15:45'],
        '01a035b1-deb2-723e-bb9e-d2ba421d377e' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Chevrolet", "color": "Rojo", "model": "Suzuky", "plate": "PTC0933", "vehicle_type": "Hatchback"}', '2026-08-24 16:34:04'],
        '01a0395d-f63d-718d-9dca-3d770637baac' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Mitsubishi", "color": "Blanco", "model": "Fuso", "plate": "PDL9247", "vehicle_type": "Camión / Van"}', '2026-08-25 09:40:54'],
        '01a03996-5de5-71b4-a8a0-ec50efac2e9d' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Great Wall", "color": "Plomo", "model": "Wingle 7", "plate": "0000", "nombre": "Jairo Ambacar", "vehicle_type": "Camioneta"}', '2026-08-25 10:42:30'],
        '01a039b9-1c92-727c-baff-93f04c44b67b' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "GMW", "color": "Azul", "model": "Jolion", "plate": "0000", "nombre": "Jairo Ambacar", "vehicle_type": "Sedán"}', '2026-08-25 11:20:27'],
        '01a039ba-7298-709b-9b2f-3fdf9b5971c7' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Livan", "color": "Gris", "model": "X3", "plate": "0000", "nombre": "Jairo Ambacar", "vehicle_type": "Sedán"}', '2026-08-25 11:21:55'],
        '01a039bd-9441-7248-a34b-48f71fa253cd' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Renault", "color": "Blanco", "model": "Sandero", "plate": "PDT5272", "nombre": "MecáNico Tuercas", "vehicle_type": "Sedán"}', '2026-08-25 11:25:20'],
        '01a039bf-50fa-72c0-b14e-e7e32062edac' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Livan", "model": "RL7", "plate": "0000", "nombre": "Jairo Ambacar", "vehicle_type": "Sedán"}', '2026-08-25 11:27:14'],
        '01a039ef-5f52-72bf-9f66-f70d71aee0b0' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Kia", "color": "Gris", "model": "Picanto", "plate": "IBF1608", "nombre": "Mecanico", "vehicle_type": "Hatchback"}', '2026-08-25 12:19:43'],
        '01a03ad5-5eee-70e0-b623-d05a12b67fc8' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Kia", "color": "Plomo", "model": "Stonic", "plate": "IBE9552", "vehicle_type": "SUV"}', '2026-08-25 16:30:57'],
        '01a03e39-ae1d-7184-a346-e9dbf21e9be9' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Chevrolet", "color": "Gris", "model": "Grand Vitara", "plate": "PBW6214", "nombre": "Gaby Arellano", "vehicle_type": "SUV"}', '2026-08-26 08:19:22'],
        '01a03e83-299a-7311-af18-afff3038e787' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Ford", "color": "Rojo", "model": "Explorer", "plate": "IBA5033", "nombre": "Don Eduardo", "vehicle_type": "Camioneta"}', '2026-08-26 09:39:38'],
        '01a04384-487d-720d-84e3-9fbc2dfde80f' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Chevrolet", "color": "Arena", "model": "D\'Max", "plate": "PPA7689", "nombre": "Don Arturo", "vehicle_type": "Camioneta"}', '2026-08-27 08:58:57'],
        '01a04392-8735-73fd-979c-d3599f7692d2' => ['019e8593-ec52-733e-b25e-8ad226e08146', '{"brand": "Chevrolet", "color": "Negra", "model": "D\'Max", "plate": "PBY2714", "nombre": "Don Mauro", "vehicle_type": "Camioneta"}', '2026-08-27 09:14:31'],
    ];

    /**
     * id del servicio => id del vehículo que tenía al registrarse.
     *
     * @var array<string, string>
     */
    private const LOGS = [
        '019fc44b-f13f-705a-978c-86184dd956d6' => '019fc448-9a0c-71b4-bcef-a78753eaaef8',
        '01a00fea-ffdc-713d-a268-0fc266588ce7' => '01a00fea-4d6f-728b-ac96-950ff2646033',
        '01a0150b-ea89-735d-93d5-413f926da333' => '01a01501-3afc-7353-9bc1-b5cb0f3f0cae',
        '01a01a55-1e46-7294-a853-5beecc577a53' => '01a01a54-593f-7242-981b-5523a9d9f037',
        '01a01f8a-ae22-7289-afd0-367ba59f0642' => '01a01a54-593f-7242-981b-5523a9d9f037',
        '01a02486-204f-7372-ba3d-0e6db2abb045' => '01a01a54-593f-7242-981b-5523a9d9f037',
        '01a02665-85f2-72c3-bf94-eedeeb075446' => '01a01a54-593f-7242-981b-5523a9d9f037',
        '01a029b2-2071-7323-85ed-0382b213084e' => '01a029b1-dfd9-73ea-b291-d8395f75fec7',
        '01a029b4-f7ee-70e6-9868-70e2c05c71d9' => '01a029b4-de68-700c-88b9-c16181afb6c4',
        '01a029c4-9e6a-7204-ba4b-1109220c0c5f' => '01a01a54-593f-7242-981b-5523a9d9f037',
        '01a02adc-958f-72e3-9e25-4d13566c205d' => '01a01a54-593f-7242-981b-5523a9d9f037',
        '01a02f22-0d9d-71dc-811e-7485fea06cab' => '01a01a54-593f-7242-981b-5523a9d9f037',
        '01a03533-5170-719f-8626-cbfda678f2db' => '01a03533-3ec7-707c-8fca-be05bf286b5c',
        '01a035b2-18fd-71e1-8efe-3633c7f3f746' => '01a035b1-deb2-723e-bb9e-d2ba421d377e',
        '01a03915-abc3-7333-a1ed-7d737aeb4575' => '01a01a54-593f-7242-981b-5523a9d9f037',
        '01a0395e-203c-719d-87d4-b8efb579abe0' => '01a0395d-f63d-718d-9dca-3d770637baac',
        '01a03996-8661-7272-a760-b2bd03df4c95' => '01a03996-5de5-71b4-a8a0-ec50efac2e9d',
        '01a039b9-4088-71d8-899e-0907c0f06a38' => '01a039b9-1c92-727c-baff-93f04c44b67b',
        '01a039ba-926a-713d-9550-aca3093b4adb' => '01a039ba-7298-709b-9b2f-3fdf9b5971c7',
        '01a039bd-cd21-7064-b16d-7811efc4abbc' => '01a039bd-9441-7248-a34b-48f71fa253cd',
        '01a039bf-72be-73b5-85c8-56bc46a2b742' => '01a039bf-50fa-72c0-b14e-e7e32062edac',
        '01a039ef-77f5-73ca-9737-4162598976fd' => '01a039ef-5f52-72bf-9f66-f70d71aee0b0',
        '01a03ad5-8243-73e9-9728-d859650ef573' => '01a03ad5-5eee-70e0-b623-d05a12b67fc8',
        '01a03b40-54c7-70b6-8beb-ade5fd6bf482' => '01a01a49-80c1-7303-aa42-fb1b1a53dfd4',
        '01a03e3a-8466-7121-b109-d8b990c8e7d4' => '01a03e39-ae1d-7184-a346-e9dbf21e9be9',
        '01a03e83-57da-7337-9331-1819188b2f0b' => '01a03e83-299a-7311-af18-afff3038e787',
        '01a03ef2-15cd-7016-b554-cabb7c2ce865' => '01a03e39-ae1d-7184-a346-e9dbf21e9be9',
        '01a04386-374b-712e-a838-cc2f080fa809' => '01a04384-487d-720d-84e3-9fbc2dfde80f',
        '01a04392-a6e9-700b-a368-3332bb9ee4eb' => '01a04392-8735-73fd-979c-d3599f7692d2',
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::RESOURCES as $id => [$tenantId, $data, $createdAt]) {
            // Sin scope de tenant: esto corre por consola, fuera de un
            // request, y toca dos locales distintos.
            if (DB::table('client_resources')->where('id', $id)->exists()) {
                continue;
            }

            // Fuera de prod estos tenants no existen —local, staging, CI— y el
            // insert reventaría contra la foránea. La reparación es de datos
            // de un local concreto: donde no está ese local, no hay nada que
            // reparar.
            if (!DB::table('tenants')->where('id', $tenantId)->exists()) {
                continue;
            }

            DB::table('client_resources')->insert([
                'id'         => $id,
                'tenant_id'  => $tenantId,
                'client_id'  => null,
                'data'       => $data,
                'type'       => 'sedan',
                'created_at' => $createdAt,
                'updated_at' => $now,
            ]);
        }

        foreach (self::LOGS as $logId => $resourceId) {
            // Sólo llena lo vacío. Un registro al que alguien ya le asignó el
            // vehículo a mano gana: esa fue una decisión de una persona.
            DB::table('service_logs')
                ->where('id', $logId)
                ->whereNull('client_resource_id')
                ->update(['client_resource_id' => $resourceId]);
        }
    }

    /**
     * Se deshace el enlace, no el vehículo: borrar la fila otra vez repetiría
     * exactamente el daño que esta migración vino a reparar.
     */
    public function down(): void
    {
        foreach (self::LOGS as $logId => $resourceId) {
            DB::table('service_logs')
                ->where('id', $logId)
                ->where('client_resource_id', $resourceId)
                ->update(['client_resource_id' => null]);
        }
    }
};
