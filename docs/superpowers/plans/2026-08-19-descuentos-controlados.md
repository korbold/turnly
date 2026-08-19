# Descuentos con motivo y reporte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que bajar el precio siga siendo posible en el mostrador, pero deje de verse igual que una venta normal: con motivo declarado, autor, y un reporte que abre con cuánto se dejó de cobrar.

**Architecture:** Ninguna tabla nueva. `service_log_items` guarda una foto del precio de catálogo al registrar; `service_logs` guarda el motivo del ticket; `reservation_item_changes` gana el código de motivo sobre la auditoría que ya escribe. El privilegio `Precio` cambia de significado: de «puede tocar el precio» a «puede hacerlo sin justificar».

**Tech Stack:** Laravel 13 (Domain → Application → Infrastructure), Pest + SQLite en memoria; Next.js 16 + React Query + shadcn/ui en `apps/admin-v2`.

**Spec:** `docs/superpowers/specs/2026-08-19-descuentos-controlados-design.md`

## Global Constraints

- **El privilegio `Precio` cambia de significado, no desaparece.** Con él, el motivo es opcional. Sin él, el motivo es **obligatorio** y el backend rechaza sin él. Lo que ya no existe es el bloqueo: hoy `firstTamperedPrice` devuelve 403 y eso es lo que se reemplaza.
- **`catalog_price` es una foto, nunca una consulta al catálogo actual.** Si mañana el lavado sube de $15 a $18, los cobros de $15 de hoy no pueden aparecer como descuentos de $3. Una fila sin `catalog_price` (histórica) **no es un descuento**: es una fila vieja, y el reporte la ignora.
- **El motivo es del ticket, no de la línea.** En el mostrador nadie escribe tres motivos para tres servicios del mismo cliente.
- **Cualquier desvío pide motivo, hacia arriba o hacia abajo.** Una sola regla. El umbral es `0.005`, el mismo centavo que ya usa `firstTamperedPrice`: el precio va y vuelve por JSON y no sobrevive una comparación exacta.
- **El reporte incluye los descuentos del dueño**, con motivo en blanco. Uno que sólo cuenta los ajenos no sirve para decidir precios.
- **El reporte vive detrás del privilegio de Reportes**, que el Cajero no tiene por default. Visible para quien los hace, no controla nada.
- Modelos en `app/Infrastructure/Persistence/Models/`. Servicios de aplicación en `app/Application/Services/`.
- Tests: `cd apps/backend && ./vendor/bin/pest <ruta>`.
- **La suite tiene 9 fallos PRE-EXISTENTES.** Verde de partida: **521 passed / 19 skipped**.
- **`tests/Feature/Report/` sólo corre contra MySQL**; en SQLite se saltea. Ver la Task 5.
- `npm run lint` ya está rojo de antes. El gate real es `npx tsc --noEmit && npm run build`.
- Admin: Next.js 16. Leé la guía en `apps/admin-v2/node_modules/next/dist/docs/`.

## Contexto verificado antes de escribir esto

| Camino | Hoy |
|---|---|
| `POST /service-logs` | 403 `PRICE_LOCKED` sin privilegio (línea ~256) |
| `PATCH /service-logs/{id}` | 403 igual (línea ~488) |
| `PUT /service-logs/{id}/items` | 403 igual (línea ~562) |
| `PATCH /reservation-items/{id}/price` | **Abierto a cualquier miembro.** `assertCanOverridePrice()` valida el estado de la reserva, no el privilegio |

`Cajero.Precio` está en `none` en los seis tenants locales.

**El override de reservas no tiene UI ni hook en el admin**: es un endpoint sin cliente, alcanzable sólo armando la request a mano. Se cierra igual, pero no hay pantalla que ajustar por ese lado.

---

### Task 1: Los motivos y las columnas

**Files:**
- Create: `apps/backend/app/Domain/Pricing/PriceChangeReason.php`
- Create: `apps/backend/database/migrations/2026_08_22_100001_add_catalog_price_to_service_log_items.php`
- Create: `apps/backend/database/migrations/2026_08_22_100002_add_price_change_reason_to_service_logs.php`
- Create: `apps/backend/database/migrations/2026_08_22_100003_add_reason_code_to_reservation_item_changes.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogItemModel.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php`
- Test: `apps/backend/tests/Feature/Pricing/PriceChangeReasonTest.php`

**Interfaces:**
- Produces:
  - `PriceChangeReason::CODES` = `['cliente_frecuente','promocion','cortesia','acordado','otro']`
  - `PriceChangeReason::LABELS` = mapa código → etiqueta en español
  - `PriceChangeReason::REQUIRES_NOTE = 'otro'`
  - `PriceChangeReason::isValid(?string $code): bool`
  - Columnas `service_log_items.catalog_price`, `service_logs.price_change_reason`, `service_logs.price_change_note`, `reservation_item_changes.reason_code`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Pricing/PriceChangeReasonTest.php

use App\Domain\Pricing\PriceChangeReason;
use Illuminate\Support\Facades\Schema;

test('the reason list is closed and every code has a label', function () {
    // Texto libre se degrada a "descuento", "x", "asd" en un mes y deja el
    // reporte sin agrupar. La lista cerrada es el punto de la feature.
    expect(PriceChangeReason::CODES)->toBe([
        'cliente_frecuente', 'promocion', 'cortesia', 'acordado', 'otro',
    ]);

    foreach (PriceChangeReason::CODES as $code) {
        expect(PriceChangeReason::LABELS[$code] ?? null)->toBeString();
    }
});

test('only otro demands a written note', function () {
    // Si el 70% cae en "otro", la lista está mal — y el reporte lo dice solo.
    expect(PriceChangeReason::REQUIRES_NOTE)->toBe('otro');
});

test('an unknown code is not valid', function () {
    expect(PriceChangeReason::isValid('cliente_frecuente'))->toBeTrue();
    expect(PriceChangeReason::isValid('cliente_especial'))->toBeFalse();
    expect(PriceChangeReason::isValid(null))->toBeFalse();
});

test('the columns exist', function () {
    expect(Schema::hasColumn('service_log_items', 'catalog_price'))->toBeTrue();
    expect(Schema::hasColumn('service_logs', 'price_change_reason'))->toBeTrue();
    expect(Schema::hasColumn('service_logs', 'price_change_note'))->toBeTrue();
    expect(Schema::hasColumn('reservation_item_changes', 'reason_code'))->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Pricing/PriceChangeReasonTest.php`
Expected: FAIL — `Class "App\Domain\Pricing\PriceChangeReason" not found`

- [ ] **Step 3: Write the reason list**

```php
<?php
// apps/backend/app/Domain/Pricing/PriceChangeReason.php

declare(strict_types=1);

namespace App\Domain\Pricing;

/**
 * Por qué un precio se apartó del catálogo.
 *
 * Lista cerrada y no configurable a propósito. Texto libre se degrada a
 * "descuento", "x", "asd" en un mes y deja el reporte sin agrupar — y peor,
 * permite escribir literalmente "cliente especial", que es la excusa que este
 * diseño existe para volver auditable.
 *
 * Cinco motivos cubren barbería, lavadora, spa y consultorio igual. Volverla
 * configurable después es leer una tabla en vez de esta constante, sin migrar
 * nada: los valores ya son categorías.
 */
final class PriceChangeReason
{
    public const CLIENTE_FRECUENTE = 'cliente_frecuente';
    public const PROMOCION         = 'promocion';
    public const CORTESIA          = 'cortesia';
    public const ACORDADO          = 'acordado';
    public const OTRO              = 'otro';

    public const CODES = [
        self::CLIENTE_FRECUENTE,
        self::PROMOCION,
        self::CORTESIA,
        self::ACORDADO,
        self::OTRO,
    ];

    public const LABELS = [
        self::CLIENTE_FRECUENTE => 'Cliente frecuente',
        self::PROMOCION         => 'Promoción',
        self::CORTESIA          => 'Reclamo o cortesía',
        self::ACORDADO          => 'Precio acordado con el dueño',
        self::OTRO              => 'Otro',
    ];

    /**
     * El único que exige nota escrita. Es también el termómetro de la lista:
     * si la mayoría de los descuentos caen acá, faltan motivos.
     */
    public const REQUIRES_NOTE = self::OTRO;

    public static function isValid(?string $code): bool
    {
        return $code !== null && in_array($code, self::CODES, true);
    }

    public static function label(?string $code): ?string
    {
        return $code === null ? null : (self::LABELS[$code] ?? null);
    }
}
```

- [ ] **Step 4: Write the three migrations**

```php
<?php
// apps/backend/database/migrations/2026_08_22_100001_add_catalog_price_to_service_log_items.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lo que el catálogo decía EN EL MOMENTO del registro.
     *
     * Es una foto, no una consulta. Sin ella el reporte miente: si mañana el
     * lavado sube de $15 a $18, todos los cobros de $15 de hoy aparecerían
     * como descuentos de $3.
     *
     * Nullable porque las filas históricas no la tienen, y una fila sin
     * catálogo NO es un descuento: es una fila vieja. El reporte la ignora.
     */
    public function up(): void
    {
        Schema::table('service_log_items', function (Blueprint $table) {
            $table->decimal('catalog_price', 12, 2)->nullable()->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('service_log_items', function (Blueprint $table) {
            $table->dropColumn('catalog_price');
        });
    }
};
```

```php
<?php
// apps/backend/database/migrations/2026_08_22_100002_add_price_change_reason_to_service_logs.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El motivo va en el ticket, no en la línea: en el mostrador nadie escribe
     * tres motivos para tres servicios del mismo cliente.
     *
     * `price_change_note` sólo se llena cuando el código es `otro`. Es string
     * y no enum por la misma razón que el resto del proyecto: SQLite no sabe
     * alterar enums, y agregar un motivo volvería a ser una migración
     * imposible de correr en test.
     */
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->string('price_change_reason', 40)->nullable()->after('price_charged');
            $table->string('price_change_note', 200)->nullable()->after('price_change_reason');
            $table->index(['tenant_id', 'price_change_reason']);
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'price_change_reason']);
            $table->dropColumn(['price_change_reason', 'price_change_note']);
        });
    }
};
```

```php
<?php
// apps/backend/database/migrations/2026_08_22_100003_add_reason_code_to_reservation_item_changes.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La auditoría de reservas ya guardaba `reason` como texto libre. El
     * código va aparte para que el reporte pueda agrupar; `reason` queda como
     * la nota.
     *
     * Nullable: las filas viejas tienen texto libre y ningún código. El
     * reporte las muestra como "Otro".
     */
    public function up(): void
    {
        Schema::table('reservation_item_changes', function (Blueprint $table) {
            $table->string('reason_code', 40)->nullable()->after('reason');
        });
    }

    public function down(): void
    {
        Schema::table('reservation_item_changes', function (Blueprint $table) {
            $table->dropColumn('reason_code');
        });
    }
};
```

- [ ] **Step 5: Widen the models**

En `ServiceLogItemModel`, agregá `'catalog_price'` a `$fillable` y al array de casts:

```php
            'catalog_price' => 'decimal:2',
```

En `ServiceLogModel`, agregá `'price_change_reason'` y `'price_change_note'` a `$fillable` (junto a `'price_charged'`).

En `ReservationItemChangeModel`, agregá `'reason_code'` a `$fillable`
(verificá el nombre del archivo con
`ls apps/backend/app/Infrastructure/Persistence/Models/ | grep -i reservationitemchange`).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Pricing/PriceChangeReasonTest.php`
Expected: PASS — 4 passed

- [ ] **Step 7: Migrate on MySQL**

Run: `cd apps/backend && php artisan migrate`
Expected: las tres corren limpias.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Domain/Pricing/PriceChangeReason.php \
        apps/backend/database/migrations/2026_08_22_1000*.php \
        apps/backend/app/Infrastructure/Persistence/Models/ \
        apps/backend/tests/Feature/Pricing/PriceChangeReasonTest.php
git commit -m "feat(descuentos): a closed list of reasons, and a snapshot of what the catalog said"
```

---

### Task 2: El mostrador puede bajar el precio, con motivo

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`store`, `update`, `updateItems`, `persistItems`, y los helpers `firstTamperedPrice` / `priceLockedResponse`)
- Modify: `apps/backend/app/Infrastructure/Http/Requests/ServiceLog/CreateServiceLogRequest.php`
- Modify: `apps/backend/app/Application/Services/ServiceLogEventRecorder.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogEventModel.php`
- Test: `apps/backend/tests/Feature/Pricing/DiscountAtCounterTest.php`

**Interfaces:**
- Consumes: `PriceChangeReason` (Task 1).
- Produces:
  - `POST /service-logs` y `PUT /service-logs/{id}/items` aceptan `price_change_reason` y `price_change_note`.
  - 422 `REASON_REQUIRED` cuando hay desvío, no hay privilegio y no hay motivo.
  - 422 `REASON_INVALID` cuando el código no está en la lista, o es `otro` sin nota.
  - `ServiceLogEventModel::EVENT_PRICE_CHANGED = 'price_changed'`.
  - `ServiceLogEventRecorder::priceChanged(ServiceLogModel $log, float $catalog, float $charged, ?string $reason, ?string $note, ?string $actorId): void`.

**Lo que se reemplaza:** hoy `firstTamperedPrice` devuelve el label de la primera línea desviada y el controlador responde 403. Ese helper **se conserva** — sigue detectando el desvío — pero deja de significar «rechazar» y pasa a significar «esto necesita motivo».

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Pricing/DiscountAtCounterTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogItemModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->member = function (string $role) {
        $user = UserModel::factory()->create();
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->owner   = ($this->member)('owner');
    $this->cashier = ($this->member)('cashier');

    // $15 de catálogo: el ejemplo exacto del dueño.
    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 15.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->register = fn (UserModel $u, float $price, array $extra = []) => ($this->as)($u)
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $u->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => $price,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('a cashier lowering the price without a reason is refused', function () {
    // El caso del dueño: cobra $15, registra $12, se queda $3.
    ($this->register)($this->cashier, 12.00)
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_REQUIRED');

    expect(ServiceLogModel::withoutGlobalScopes()->count())->toBe(0);
});

test('a cashier lowering the price with a reason goes through', function () {
    // Los clientes especiales existen. Bloquear traba el mostrador.
    $res = ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'cliente_frecuente',
    ])->assertStatus(201);

    $log = ServiceLogModel::withoutGlobalScopes()->find($res->json('data.id'));
    expect((float) $log->price_charged)->toBe(12.0);
    expect($log->price_change_reason)->toBe('cliente_frecuente');

    // La foto del catálogo, sin la cual el reporte no puede calcular nada.
    $item = ServiceLogItemModel::withoutGlobalScopes()->where('service_log_id', $log->id)->first();
    expect((float) $item->catalog_price)->toBe(15.0);
    expect((float) $item->unit_price)->toBe(12.0);
});

test('registering at the catalog price needs no reason', function () {
    // El caso normal no puede pedir nada: es el 95% de los registros.
    ($this->register)($this->cashier, 15.00)->assertStatus(201);
});

test('the owner may discount without justifying', function () {
    // El privilegio Precio pasa a significar "puede hacerlo sin motivo".
    $res = ($this->register)($this->owner, 12.00)->assertStatus(201);

    $log = ServiceLogModel::withoutGlobalScopes()->find($res->json('data.id'));
    expect($log->price_change_reason)->toBeNull();
    // Pero la foto se guarda igual: el reporte tiene que contarlo.
    $item = ServiceLogItemModel::withoutGlobalScopes()->where('service_log_id', $log->id)->first();
    expect((float) $item->catalog_price)->toBe(15.0);
});

test('an unknown reason code is refused', function () {
    ($this->register)($this->cashier, 12.00, ['price_change_reason' => 'cliente_especial'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_INVALID');
});

test('otro without a note is refused', function () {
    // Sin nota, "Otro" es texto libre disfrazado de categoría.
    ($this->register)($this->cashier, 12.00, ['price_change_reason' => 'otro'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_INVALID');

    ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'otro',
        'price_change_note'   => 'amigo del dueño',
    ])->assertStatus(201);
});

test('charging ABOVE catalog also needs a reason', function () {
    // Una sola regla, sin casos especiales. Un recargo sin explicar tampoco
    // debería existir.
    ($this->register)($this->cashier, 18.00)
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_REQUIRED');
});

test('the trail records catalog, charged and reason', function () {
    $id = ($this->register)($this->cashier, 12.00, [
        'price_change_reason' => 'promocion',
    ])->json('data.id');

    $evento = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', 'price_changed')
        ->first();

    expect($evento)->not->toBeNull();
    expect((float) $evento->detail['catalog'])->toBe(15.0);
    expect((float) $evento->detail['charged'])->toBe(12.0);
    expect($evento->detail['reason'])->toBe('promocion');
});

test('editing the items down later also needs a reason', function () {
    $id = ($this->register)($this->cashier, 15.00)->json('data.id');

    ($this->as)($this->cashier)
        ->putJson("/api/v1/service-logs/{$id}/items", [
            'items' => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
        ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'REASON_REQUIRED');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Pricing/DiscountAtCounterTest.php`
Expected: FAIL — hoy el primer test devuelve 403 `PRICE_LOCKED`, no 422 `REASON_REQUIRED`.

- [ ] **Step 3: Add the event and the recorder method**

En `ServiceLogEventModel`, junto a las otras constantes:

```php
    /** El precio se apartó del catálogo. Con cuánto, y por qué. */
    public const EVENT_PRICE_CHANGED = 'price_changed';
```

En `ServiceLogEventRecorder`:

```php
    /**
     * El precio no fue el del catálogo. Sin este evento un descuento se ve
     * igual que una venta normal, que es exactamente el problema.
     */
    public function priceChanged(
        ServiceLogModel $log,
        float $catalog,
        float $charged,
        ?string $reason,
        ?string $note,
        ?string $actorId,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_PRICE_CHANGED, [
            'catalog'    => $catalog,
            'charged'    => $charged,
            'difference' => round($charged - $catalog, 2),
            'reason'     => $reason,
            'note'       => $note,
        ], $actorId);
    }
```

- [ ] **Step 4: Replace the block with a reason gate**

En `ServiceLogController`, agregá el import `use App\Domain\Pricing\PriceChangeReason;` y estos dos helpers junto a `priceLockedResponse` (que **se conserva**: el `update()` de la Task 2 Step 6 lo sigue usando):

```php
    /**
     * Valida el motivo de un desvío de precio. Devuelve la respuesta de error
     * o null si está todo bien.
     *
     * Sin el privilegio `Precio` el motivo es obligatorio; con él es opcional.
     * Ese es el cambio de significado del privilegio: de "puede tocar el
     * precio" a "puede hacerlo sin justificar".
     */
    private function priceReasonProblem(Request $request, string $label): ?JsonResponse
    {
        $reason = $request->input('price_change_reason');
        $note   = $request->input('price_change_note');

        if ($reason === null || $reason === '') {
            if ($this->may($request, StaffPrivileges::PRICE)) {
                return null;
            }

            return response()->json([
                'error' => [
                    'code'    => 'REASON_REQUIRED',
                    'message' => "El precio de \"{$label}\" no es el del catálogo. Elegí un motivo.",
                ],
            ], 422);
        }

        if (!PriceChangeReason::isValid($reason)) {
            return $this->reasonInvalid('Ese motivo no existe.');
        }

        if ($reason === PriceChangeReason::REQUIRES_NOTE && trim((string) $note) === '') {
            return $this->reasonInvalid('Elegiste "Otro": escribí de qué se trata.');
        }

        return null;
    }

    private function reasonInvalid(string $message): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'REASON_INVALID', 'message' => $message],
        ], 422);
    }
```

En `store()`, el bloque que hoy dice:

```php
        if (!$this->may($request, StaffPrivileges::PRICE)) {
            $lines = $hasItems ? $items : [[ /* ... */ ]];

            $tampered = $this->firstTamperedPrice($lines);
            if ($tampered !== null) {
                return $this->priceLockedResponse($tampered);
            }
        }
```

pasa a:

```php
        // El desvío ya no se bloquea: se justifica. Bloquear obliga a llamar
        // al dueño por cada cliente especial, y a la tercera vez el dueño
        // concede el privilegio "para que la caja no se trabe" — que es cómo
        // se pasa de prohibido a invisible.
        $lines = $hasItems ? $items : [[
            'service_id' => $request->service_id,
            'variant_id' => $request->service_variant_id,
            'unit_price' => (float) $request->price_charged,
            'label'      => 'servicio',
        ]];

        $desviada = $this->firstTamperedPrice($lines);
        if ($desviada !== null) {
            $problema = $this->priceReasonProblem($request, $desviada);
            if ($problema !== null) {
                return $problema;
            }
        }
```

y, en el `$patch` que ya arma el `store()`, agregá el motivo cuando lo haya:

```php
        if ($desviada !== null) {
            $patch['price_change_reason'] = $request->input('price_change_reason');
            $patch['price_change_note']   = $request->input('price_change_reason') === PriceChangeReason::REQUIRES_NOTE
                ? $request->input('price_change_note')
                : null;
        }
```

- [ ] **Step 5: Snapshot the catalog price**

En `persistItems()`, la fila del item gana la foto. Reemplazá el `ServiceLogItemModel::create([...])` por:

```php
            ServiceLogItemModel::create([
                'tenant_id'      => $tenantId,
                'service_log_id' => $serviceLogId,
                'item_type'      => $isProduct ? 'product' : 'service_variant',
                'ref_id'         => $refId,
                'label'          => $line['label'],
                'qty'            => $qty,
                'unit_price'     => $unit,
                // Foto del catálogo, no consulta: el precio de la lista cambia
                // y este número no puede cambiar con él.
                'catalog_price'  => $this->catalogPrice($line),
                'line_total'     => $unit * $qty,
                'sort_order'     => $sort++,
            ]);
```

Y después de `$this->events->created(...)` en `store()`, registrá el evento cuando hubo desvío:

```php
        if ($desviada !== null) {
            $catalogo = array_sum(array_map(
                fn ($l) => (float) ($this->catalogPrice($l) ?? $l['unit_price']) * (float) ($l['qty'] ?? 1),
                $lines,
            ));

            $this->events->priceChanged(
                $logModel,
                round($catalogo, 2),
                (float) $logModel->price_charged,
                $request->input('price_change_reason'),
                $request->input('price_change_note'),
                $request->user()?->id,
            );
        }
```

- [ ] **Step 6: Same gate on updateItems(), and leave update() alone**

En `updateItems()`, el bloque de `firstTamperedPrice` pasa al mismo patrón: si hay desvío, pedir motivo en vez de rechazar, y persistir `price_change_reason` / `price_change_note` en el log.

**`update()` no cambia.** Ese endpoint edita `price_charged` suelto, sin líneas, así que no hay catálogo contra el cual comparar: sigue devolviendo 403 sin el privilegio. Cambiarlo requeriría recalcular el catálogo desde los items ya guardados, y es un camino que la UI no usa para descontar.

- [ ] **Step 7: Accept the two fields in the request**

En `CreateServiceLogRequest`, junto a `amount_received`:

```php
            // Motivo del desvío de precio. Obligatorio sin el privilegio
            // Precio; la validación fina vive en el controlador porque
            // depende de si hubo desvío.
            'price_change_reason' => ['nullable', 'string', 'max:40'],
            'price_change_note'   => ['nullable', 'string', 'max:200'],
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Pricing/DiscountAtCounterTest.php`
Expected: PASS — 9 passed

- [ ] **Step 9: Run every service-log test**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ tests/Feature/Pricing/`
Expected: sólo el fallo pre-existente `ServiceLogTest > create service log requires required fields`. **Ojo:** puede haber tests que hoy esperan 403 `PRICE_LOCKED` al registrar con precio distinto. Esos describen la política vieja y **deben actualizarse** al nuevo contrato (422 `REASON_REQUIRED`), no borrarse: siguen siendo la prueba de que el cajero no descuenta en silencio. Buscalos con `grep -rn "PRICE_LOCKED" tests/`.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/app/Infrastructure/Http/Requests/ServiceLog/CreateServiceLogRequest.php \
        apps/backend/app/Application/Services/ServiceLogEventRecorder.php \
        apps/backend/app/Infrastructure/Persistence/Models/ServiceLogEventModel.php \
        apps/backend/tests/Feature/Pricing/DiscountAtCounterTest.php
git commit -m "feat(descuentos): the counter may discount, but has to say why"
```

---

### Task 3: Reservaciones deja de ser la puerta abierta

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationItemController.php` (`overridePrice`)
- Modify: `apps/backend/app/Domain/Reservation/ReservationItemEditor.php` (`overridePrice`)
- Test: `apps/backend/tests/Feature/Pricing/ReservationOverrideReasonTest.php`

**Interfaces:**
- Consumes: `PriceChangeReason` (Task 1).
- Produces: `PATCH /reservation-items/{id}/price` exige `reason_code` de la lista y guarda el código junto a la nota.

**Contexto:** hoy el endpoint valida `reason` como texto libre obligatorio, y `assertCanOverridePrice()` valida el **estado** de la reserva —no pagada, en check-in— pero **no el privilegio**. Esta tarea no cierra el acceso: lo alinea con el mostrador. El código de motivo pasa a ser obligatorio para todos, con o sin privilegio, porque a diferencia del Registro Diario acá no hay un caso «el dueño registra al precio de lista» — tocar este endpoint ya es, por definición, un desvío.

**Este endpoint no tiene UI ni hook en el admin.** Se cierra igual, pero no hay pantalla que ajustar.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Pricing/ReservationOverrideReasonTest.php

use App\Infrastructure\Persistence\Models\ReservationItemChangeModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->cashier = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->cashier->id, 'role' => 'cashier', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 15.00]);

    $this->reservation = ReservationModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id,
        'created_by' => $this->cashier->id,
        'status' => 'checked_in',
        'payment_status' => 'unpaid',
        'scheduled_at' => now(),
    ]);

    $this->item = ReservationItemModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'reservation_id' => $this->reservation->id,
        'item_type' => 'service',
        'ref_id' => $service->id,
        'label' => 'Lavado',
        'qty' => 1,
        'unit_price' => 15.00,
        'line_total' => 15.00,
    ]);

    $this->override = fn (array $body) => $this->actingAs($this->cashier)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/reservation-items/{$this->item->id}/price", $body);
});

test('a free-text reason is no longer enough', function () {
    // Antes aceptaba cualquier texto, incluido "cliente especial", que es la
    // excusa que este diseño existe para volver auditable.
    ($this->override)(['unit_price' => 12.00, 'reason' => 'cliente especial'])
        ->assertStatus(422);

    expect((float) $this->item->fresh()->unit_price)->toBe(15.0);
});

test('a code from the list goes through and is stored', function () {
    ($this->override)([
        'unit_price'  => 12.00,
        'reason_code' => 'cliente_frecuente',
    ])->assertOk();

    expect((float) $this->item->fresh()->unit_price)->toBe(12.0);

    $audit = ReservationItemChangeModel::withoutGlobalScopes()
        ->where('action', 'price_override')->first();
    expect($audit->reason_code)->toBe('cliente_frecuente');
    expect((float) $audit->old_price)->toBe(15.0);
    expect((float) $audit->new_price)->toBe(12.0);
    expect($audit->changed_by_user_id)->toBe($this->cashier->id);
});

test('otro still demands the note', function () {
    ($this->override)(['unit_price' => 12.00, 'reason_code' => 'otro'])
        ->assertStatus(422);

    ($this->override)([
        'unit_price'  => 12.00,
        'reason_code' => 'otro',
        'reason'      => 'amigo del dueño',
    ])->assertOk();
});

test('an unknown code is refused', function () {
    ($this->override)(['unit_price' => 12.00, 'reason_code' => 'porque_si'])
        ->assertStatus(422);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Pricing/ReservationOverrideReasonTest.php`
Expected: FAIL — el primero pasa hoy con texto libre (200 en vez de 422).

- [ ] **Step 3: Require the code in the controller**

En `ReservationItemController::overridePrice()`, la validación pasa a:

```php
        $data = $request->validate([
            'unit_price'  => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            // El código es obligatorio: tocar este endpoint ya es, por
            // definición, un desvío del catálogo.
            'reason_code' => ['required', 'string', Rule::in(PriceChangeReason::CODES)],
            // La nota es libre y sólo obligatoria para "otro".
            'reason'      => ['nullable', 'string', 'max:500'],
        ]);

        if ($data['reason_code'] === PriceChangeReason::REQUIRES_NOTE
            && trim((string) ($data['reason'] ?? '')) === '') {
            return response()->json([
                'error' => [
                    'code'    => 'REASON_INVALID',
                    'message' => 'Elegiste "Otro": escribí de qué se trata.',
                ],
            ], 422);
        }
```

con los imports `use App\Domain\Pricing\PriceChangeReason;` y `use Illuminate\Validation\Rule;`.

La llamada al editor pasa el código:

```php
            $item = $this->editor->overridePrice(
                $item->reservation,
                $item,
                (float) $data['unit_price'],
                $request->user()?->id,
                $data['reason'] ?? null,
                $data['reason_code'],
            );
```

- [ ] **Step 4: Carry the code through the editor**

En `ReservationItemEditor::overridePrice()`, agregá el parámetro al final y pasalo al `audit()`:

```php
    public function overridePrice(
        ReservationModel $reservation,
        ReservationItemModel $item,
        float $newPrice,
        ?string $userId,
        ?string $reason,
        ?string $reasonCode = null,
    ): ReservationItemModel {
```

Leé la firma de `audit()` antes de editar
(`grep -n "private function audit" -A 20 app/Domain/Reservation/ReservationItemEditor.php`)
y agregale un parámetro `?string $reasonCode = null` que escriba `reason_code`
en la fila. Es el último parámetro y tiene default, así que las otras cinco
llamadas a `audit()` no cambian.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Pricing/ReservationOverrideReasonTest.php`
Expected: PASS — 4 passed

- [ ] **Step 6: Run the reservation suite**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Reservation/`
Expected: verde. Si un test viejo manda `reason` como texto libre y ahora recibe 422, **actualizalo al contrato nuevo** — describe la política vieja.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationItemController.php \
        apps/backend/app/Domain/Reservation/ReservationItemEditor.php \
        apps/backend/tests/Feature/Pricing/ReservationOverrideReasonTest.php
git commit -m "feat(descuentos): the reservation override speaks the same reason list"
```

---

### Task 4: El reporte

**Files:**
- Create: `apps/backend/app/Application/Services/DiscountReport.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Report/ReportController.php` (método `discounts()`)
- Modify: `apps/backend/routes/api.php`
- Test: `apps/backend/tests/Feature/Pricing/DiscountReportTest.php`

**Interfaces:**
- Consumes: `catalog_price` (Task 1), `reservation_item_changes.reason_code` (Task 3).
- Produces: `GET /api/v1/reports/discounts?date_from&date_to`

```
{ "data": {
    "total_given_away": 312.00,
    "by_reason":  [ { "code": "cliente_frecuente", "label": "Cliente frecuente", "total": 180.00, "count": 12 } ],
    "by_user":    [ { "user_id": "...", "name": "Cajero AutoSpa", "total": 260.00, "count": 18 } ],
    "items":      [ { "source": "service_log"|"reservation", "id", "date", "user_name",
                      "client_label", "service_label", "catalog", "charged",
                      "difference", "reason_code", "reason_label", "note" } ]
} }
```

`total_given_away` es la suma de las **diferencias negativas**: lo que se dejó de cobrar. Un recargo no la compensa — mezclarlos daría un neto que esconde ambos.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Pricing/DiscountReportTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogItemModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    if (config('database.default') === 'sqlite') {
        $this->markTestSkipped('Los reportes se prueban contra MySQL: en SQLite log_date conserva la hora y whereBetween no encuentra nada.');
    }

    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create(['name' => 'Dueño']);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);
    $this->cajero = UserModel::factory()->create(['name' => 'Cajero']);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->cajero->id, 'role' => 'cashier', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 15.00]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->hoy = now()->toDateString();

    $this->venta = function (float $catalogo, float $cobrado, ?string $motivo, UserModel $quien)
        use ($service, $resource) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $resource->id,
            'service_id' => $service->id,
            'attended_by' => $quien->id,
            'created_by' => $quien->id,
            'price_charged' => $cobrado,
            'price_change_reason' => $motivo,
            'log_date' => now()->toDateString(),
        ]);
        ServiceLogItemModel::create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'service_log_id' => $log->id,
            'item_type' => 'service_variant',
            'ref_id' => $service->id,
            'label' => 'Lavado',
            'qty' => 1,
            'unit_price' => $cobrado,
            'catalog_price' => $catalogo,
            'line_total' => $cobrado,
        ]);
        return $log;
    };

    $this->reporte = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reports/discounts?date_from={$this->hoy}&date_to={$this->hoy}");
});

test('a sale at catalog price is not a discount', function () {
    ($this->venta)(15.00, 15.00, null, $this->cajero);

    ($this->reporte)()->assertOk()
        ->assertJsonPath('data.total_given_away', 0)
        ->assertJsonCount(0, 'data.items');
});

test('a row with no catalog snapshot is old, not a discount', function () {
    // Las filas históricas no tienen catalog_price. Contarlas inventaría
    // descuentos que nunca existieron.
    $log = ($this->venta)(15.00, 12.00, 'promocion', $this->cajero);
    ServiceLogItemModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)->update(['catalog_price' => null]);

    ($this->reporte)()->assertOk()->assertJsonCount(0, 'data.items');
});

test('the headline is what was given away', function () {
    ($this->venta)(15.00, 12.00, 'cliente_frecuente', $this->cajero);   // −3
    ($this->venta)(15.00, 10.00, 'promocion', $this->cajero);           // −5

    ($this->reporte)()->assertOk()
        ->assertJsonPath('data.total_given_away', 8)
        ->assertJsonCount(2, 'data.items');
});

test('a surcharge does not offset a discount', function () {
    // Mezclarlos daría un neto que esconde los dos.
    ($this->venta)(15.00, 12.00, 'cliente_frecuente', $this->cajero);   // −3
    ($this->venta)(15.00, 18.00, 'acordado', $this->cajero);            // +3

    ($this->reporte)()->assertOk()
        ->assertJsonPath('data.total_given_away', 3)
        ->assertJsonCount(2, 'data.items');
});

test('it groups by reason', function () {
    ($this->venta)(15.00, 12.00, 'cliente_frecuente', $this->cajero);
    ($this->venta)(15.00, 13.00, 'cliente_frecuente', $this->cajero);
    ($this->venta)(15.00, 10.00, 'promocion', $this->cajero);

    $res = ($this->reporte)()->assertOk();
    $porMotivo = collect($res->json('data.by_reason'))->keyBy('code');

    expect((float) $porMotivo['cliente_frecuente']['total'])->toBe(5.0);
    expect($porMotivo['cliente_frecuente']['count'])->toBe(2);
    expect($porMotivo['cliente_frecuente']['label'])->toBe('Cliente frecuente');
    expect((float) $porMotivo['promocion']['total'])->toBe(5.0);
});

test('it groups by who did it', function () {
    // La comparación entre personas es lo que delata.
    ($this->venta)(15.00, 12.00, 'cliente_frecuente', $this->cajero);
    ($this->venta)(15.00, 14.00, null, $this->owner);

    $porUsuario = collect(($this->reporte)()->json('data.by_user'))->keyBy('name');

    expect((float) $porUsuario['Cajero']['total'])->toBe(3.0);
    expect((float) $porUsuario['Dueño']['total'])->toBe(1.0);
});

test('the owners discount shows with no reason, not hidden', function () {
    // Un reporte que sólo cuenta los descuentos ajenos no sirve para decidir
    // precios.
    ($this->venta)(15.00, 12.00, null, $this->owner);

    $item = ($this->reporte)()->json('data.items.0');
    expect($item['reason_code'])->toBeNull();
    expect((float) $item['difference'])->toBe(-3.0);
});

test('a cashier cannot read the discount report', function () {
    // Visible para quien los hace, no controla nada.
    $this->actingAs($this->cajero)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reports/discounts?date_from={$this->hoy}&date_to={$this->hoy}")
        ->assertStatus(403);
});
```

- [ ] **Step 2: Run test to verify it fails — against MySQL**

```bash
cd apps/backend
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS turnly_test; CREATE DATABASE turnly_test;"
DB_CONNECTION=mysql DB_DATABASE=turnly_test php artisan migrate --force
DB_CONNECTION=mysql DB_DATABASE=turnly_test ./vendor/bin/pest tests/Feature/Pricing/DiscountReportTest.php
```
Expected: FAIL — 404, la ruta no existe. **Contra SQLite los 8 se saltean y parece que pasaron.**

- [ ] **Step 3: Write the service**

```php
<?php
// apps/backend/app/Application/Services/DiscountReport.php

declare(strict_types=1);

namespace App\Application\Services;

use App\Domain\Pricing\PriceChangeReason;
use App\Infrastructure\Persistence\Models\ReservationItemChangeModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;

/**
 * Cuánto se dejó de cobrar, quién lo decidió y por qué.
 *
 * Une los dos orígenes —registros del día y overrides de reservas— porque al
 * dueño no le importa por qué pantalla entró la plata que no entró.
 */
class DiscountReport
{
    private const CENT = 0.005;

    /**
     * @return array{total_given_away: float, by_reason: array, by_user: array, items: array}
     */
    public function between(string $tenantId, string $from, string $to): array
    {
        $items = array_merge(
            $this->fromServiceLogs($tenantId, $from, $to),
            $this->fromReservations($tenantId, $from, $to),
        );

        usort($items, fn ($a, $b) => $b['date'] <=> $a['date']);

        // Sólo lo regalado. Un recargo no compensa un descuento: el neto
        // escondería los dos.
        $regalado = array_sum(array_map(
            fn ($i) => $i['difference'] < 0 ? -$i['difference'] : 0.0,
            $items,
        ));

        return [
            'total_given_away' => round($regalado, 2),
            'by_reason'        => $this->group($items, 'reason_code'),
            'by_user'          => $this->group($items, 'user_id'),
            'items'            => $items,
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function fromServiceLogs(string $tenantId, string $from, string $to): array
    {
        $logs = ServiceLogModel::query()
            ->forTenant($tenantId)
            ->with(['items', 'attendant', 'clientResource'])
            ->whereBetween('log_date', [$from, $to])
            ->get();

        $out = [];

        foreach ($logs as $log) {
            // Una línea sin foto del catálogo es histórica, no un descuento.
            $conFoto = $log->items->filter(fn ($i) => $i->catalog_price !== null);
            if ($conFoto->isEmpty()) {
                continue;
            }

            $catalogo = (float) $conFoto->sum(fn ($i) => (float) $i->catalog_price * (float) $i->qty);
            $cobrado  = (float) $conFoto->sum(fn ($i) => (float) $i->unit_price * (float) $i->qty);
            $dif      = round($cobrado - $catalogo, 2);

            if (abs($dif) <= self::CENT) {
                continue;
            }

            $out[] = [
                'source'        => 'service_log',
                'id'            => $log->id,
                'date'          => ($log->started_at ?? $log->created_at)?->toIso8601String(),
                'user_id'       => $log->attended_by,
                'user_name'     => $log->attendant?->name,
                // Las claves de `data` son campos personalizados por tenant
                // — uno puede tener "placa" y otro sólo "name" — así que la
                // etiqueta sale del helper que ya la arma en todas partes.
                'client_label'  => $log->clientResource
                    ? \App\Infrastructure\Http\Resources\ClientResourceResource::labelFrom($log->clientResource->data)
                    : null,
                'service_label' => $conFoto->first()->label,
                'catalog'       => round($catalogo, 2),
                'charged'       => round($cobrado, 2),
                'difference'    => $dif,
                'reason_code'   => $log->price_change_reason,
                'reason_label'  => PriceChangeReason::label($log->price_change_reason),
                'note'          => $log->price_change_note,
            ];
        }

        return $out;
    }

    /** @return array<int, array<string, mixed>> */
    private function fromReservations(string $tenantId, string $from, string $to): array
    {
        return ReservationItemChangeModel::query()
            ->forTenant($tenantId)
            ->with('changedBy')
            ->where('action', ReservationItemChangeModel::ACTION_PRICE_OVERRIDE)
            ->whereBetween('changed_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->get()
            ->map(fn ($c) => [
                'source'        => 'reservation',
                'id'            => $c->id,
                'date'          => $c->changed_at?->toIso8601String(),
                'user_id'       => $c->changed_by_user_id,
                'user_name'     => $c->changedBy?->name,
                'client_label'  => null,
                'service_label' => $c->label,
                'catalog'       => (float) $c->old_price,
                'charged'       => (float) $c->new_price,
                'difference'    => round((float) $c->new_price - (float) $c->old_price, 2),
                // Las filas viejas tienen texto libre y ningún código.
                'reason_code'   => $c->reason_code,
                'reason_label'  => PriceChangeReason::label($c->reason_code) ?? 'Otro',
                'note'          => $c->reason,
            ])
            ->filter(fn ($i) => abs($i['difference']) > self::CENT)
            ->values()
            ->all();
    }

    /**
     * Agrupa sumando sólo lo regalado, igual que el titular: un cajero que
     * descuenta $50 y recarga $50 no está en cero.
     */
    private function group(array $items, string $key): array
    {
        $acc = [];

        foreach ($items as $i) {
            if ($i['difference'] >= 0) {
                continue;
            }

            $k = $i[$key] ?? '__none__';
            $acc[$k] ??= [
                'code'  => $i['reason_code'],
                'label' => $i['reason_label'] ?? 'Sin motivo',
                'name'  => $i['user_name'] ?? 'Sin usuario',
                'total' => 0.0,
                'count' => 0,
            ];
            $acc[$k]['total'] = round($acc[$k]['total'] - $i['difference'], 2);
            $acc[$k]['count']++;
        }

        $out = array_values($acc);
        usort($out, fn ($a, $b) => $b['total'] <=> $a['total']);

        return $out;
    }
}
```

- [ ] **Step 4: Wire the endpoint**

En `ReportController`, agregá el método y el import `use App\Application\Services\DiscountReport;`:

```php
    /**
     * Descuentos del rango. Detrás de `ensureFeature()` como el resto de
     * Reportes, que el Cajero no tiene por default: un reporte de descuentos
     * visible para quien los hace no controla nada.
     */
    public function discounts(Request $request, DiscountReport $report): JsonResponse
    {
        $this->ensureFeature();

        $request->validate([
            'date_from' => 'sometimes|date',
            'date_to'   => 'sometimes|date|after_or_equal:date_from',
        ]);

        $from = $request->get('date_from', now()->startOfMonth()->toDateString());
        $to   = $request->get('date_to', now()->toDateString());

        return response()->json([
            'data' => $report->between(app('current_tenant_id'), $from, $to),
        ]);
    }
```

y en `routes/api.php`, junto a las otras rutas de reportes:

```php
            Route::get('reports/discounts', [ReportController::class, 'discounts']);
```

**Verificá que `ensureFeature()` devuelva 403 para el cajero.** Hoy comprueba el
plan (`hasFeature('reports')`), no el rol. Si el Cajero de un plan Premium
pasa, agregá el gate de sección: la matriz ya tiene `Reportes` en `none` para
Cajero, y el chequeo es el mismo patrón de `ServiceLogController::may()`. El
test `a cashier cannot read the discount report` es el que lo decide.

- [ ] **Step 5: Run test to verify it passes**

```bash
DB_CONNECTION=mysql DB_DATABASE=turnly_test ./vendor/bin/pest tests/Feature/Pricing/DiscountReportTest.php
```
Expected: PASS — 8 passed

- [ ] **Step 6: Commit**

```bash
mysql -h127.0.0.1 -uroot -e "DROP DATABASE turnly_test;"
git add apps/backend/app/Application/Services/DiscountReport.php \
        apps/backend/app/Infrastructure/Http/Controllers/Report/ReportController.php \
        apps/backend/routes/api.php \
        apps/backend/tests/Feature/Pricing/DiscountReportTest.php
git commit -m "feat(descuentos): a report that opens with what was given away"
```

---

### Task 5: El mostrador pide el motivo

**Files:**
- Create: `apps/admin-v2/src/shared/constants/price-change-reasons.ts`
- Modify: `apps/admin-v2/src/domain/repositories/service-log.repository.ts` (`CreateServiceLogData`)
- Modify: `apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts` (`create`)
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/new-service-modal.tsx`

**Interfaces:**
- Consumes: el contrato de la Task 2.
- Produces:

```ts
export const PRICE_CHANGE_REASONS = [
  { code: 'cliente_frecuente', label: 'Cliente frecuente' },
  { code: 'promocion',         label: 'Promoción' },
  { code: 'cortesia',          label: 'Reclamo o cortesía' },
  { code: 'acordado',          label: 'Precio acordado con el dueño' },
  { code: 'otro',              label: 'Otro' },
] as const;
export const REASON_REQUIRES_NOTE = 'otro';
```

y `CreateServiceLogData` gana `priceChangeReason?: string` y `priceChangeNote?: string`.

**El cambio de fondo en el modal:** hoy el input de precio unitario está
`disabled` cuando `!canSetPrice`, con el título «Tu rol no tiene permiso para
cambiar el precio». Ahora **se habilita para todos**, y cuando el precio
escrito se aparta del de catálogo aparece el selector de motivo. Sin motivo,
`canSubmit` es false.

Sin test automatizado: `admin-v2` no tiene tests de componentes. Se verifica en
la Task 7, en el navegador.

- [ ] **Step 1: Write the constants**

```ts
// apps/admin-v2/src/shared/constants/price-change-reasons.ts

/**
 * Espejo de `App\Domain\Pricing\PriceChangeReason`. Lista cerrada a propósito:
 * texto libre se degrada a "descuento", "x", "asd" en un mes y deja el
 * reporte sin agrupar.
 *
 * Si acá y el backend divergen, el backend rechaza con REASON_INVALID.
 */
export const PRICE_CHANGE_REASONS = [
  { code: 'cliente_frecuente', label: 'Cliente frecuente' },
  { code: 'promocion',         label: 'Promoción' },
  { code: 'cortesia',          label: 'Reclamo o cortesía' },
  { code: 'acordado',          label: 'Precio acordado con el dueño' },
  { code: 'otro',              label: 'Otro' },
] as const;

export type PriceChangeReasonCode = (typeof PRICE_CHANGE_REASONS)[number]['code'];

/** El único que exige nota escrita. */
export const REASON_REQUIRES_NOTE: PriceChangeReasonCode = 'otro';

export const REASON_LABEL: Record<string, string> = Object.fromEntries(
  PRICE_CHANGE_REASONS.map((r) => [r.code, r.label]),
);
```

- [ ] **Step 2: Thread the two fields through the DTO**

En `CreateServiceLogData` (`src/domain/repositories/service-log.repository.ts`),
junto a `amountReceived`:

```ts
  /** Motivo del desvío de precio. Obligatorio sin el privilegio Precio. */
  priceChangeReason?: string;
  priceChangeNote?: string;
```

En `api-service-log.repository.ts`, dentro de `create()`, junto al bloque de
`amount_received`:

```ts
    if (data.priceChangeReason) {
      body.price_change_reason = data.priceChangeReason;
      if (data.priceChangeNote) {
        body.price_change_note = data.priceChangeNote;
      }
    }
```

- [ ] **Step 3: Enable the price input and detect the deviation**

En `new-service-modal.tsx`:

1. Localizá el input de precio unitario con
   `grep -n "no tiene permiso para cambiar el precio" src/presentation/components/features/service-logs/new-service-modal.tsx`
   y **quitá el `disabled`** y ese `title`. El precio se edita siempre.

2. El catálogo de cada línea ya está en el estado del modal (la variante
   elegida trae su precio). Agregá el cálculo del desvío:

```tsx
  // Un desvío del catálogo, en cualquier dirección. El centavo de tolerancia
  // es el mismo del backend: el precio va y vuelve por JSON.
  const hayDesvio = useMemo(
    () => lineItems.some((it) => {
      const catalogo = it.catalogPrice ?? it.unitPrice;
      return Math.abs(it.unitPrice - catalogo) > 0.005;
    }),
    [lineItems],
  );
```

   **Si la línea no guarda el precio de catálogo**, agregalo al armar
   `lineItems` desde el servicio o la variante elegida: es el precio con el que
   la línea entra antes de que el cajero lo toque. Sin eso no hay contra qué
   comparar.

3. El selector, visible sólo con desvío:

```tsx
        {hayDesvio && (
          <div className="space-y-2 rounded-lg border border-[var(--warning-200)] bg-[var(--warning-50)] p-3">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--warning-700)]">
              El precio no es el del catálogo · motivo
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRICE_CHANGE_REASONS.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setPriceReason(r.code)}
                  aria-pressed={priceReason === r.code}
                  className={cn(
                    'rounded-lg border px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors',
                    priceReason === r.code
                      ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                      : 'border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-sunken)]',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {priceReason === REASON_REQUIRES_NOTE && (
              <input
                value={priceNote}
                onChange={(e) => setPriceNote(e.target.value)}
                maxLength={200}
                placeholder="¿De qué se trata?"
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[14px]"
              />
            )}
          </div>
        )}
```

   con `const [priceReason, setPriceReason] = useState<string>('')` y
   `const [priceNote, setPriceNote] = useState('')`, ambos reseteados al abrir.

4. `canSubmit` gana la condición:

```tsx
    && (!hayDesvio
      || (!!priceReason
        && (priceReason !== REASON_REQUIRES_NOTE || !!priceNote.trim())))
```

5. El submit los manda:

```tsx
        ...(hayDesvio && priceReason
          ? { priceChangeReason: priceReason, priceChangeNote: priceNote.trim() || undefined }
          : {}),
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin errores. Correlo hasta el final.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/shared/constants/price-change-reasons.ts \
        apps/admin-v2/src/domain/repositories/service-log.repository.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts \
        apps/admin-v2/src/presentation/components/features/service-logs/new-service-modal.tsx
git commit -m "feat(descuentos): the counter can set the price again, and says why"
```

---

### Task 6: La pantalla del reporte

**Files:**
- Create: `apps/admin-v2/src/domain/entities/discount-report.ts`
- Create: `apps/admin-v2/src/application/use-cases/reports/get-discount-report.use-case.ts`
- Modify: `apps/admin-v2/src/domain/repositories/report.repository.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/repositories/api-report.repository.ts`
- Modify: `apps/admin-v2/src/presentation/hooks/use-reports.ts`
- Create: `apps/admin-v2/src/presentation/components/features/reports/discounts-section.tsx`
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/reports/page.tsx`

**Interfaces:**
- Consumes: `GET /reports/discounts` (Task 4).
- Produces: `useDiscountReport(from, to)` y `<DiscountsSection from to />`.

- [ ] **Step 1: Entity, repository and hook**

```ts
// apps/admin-v2/src/domain/entities/discount-report.ts

/** Un precio que se apartó del catálogo, de cualquiera de los dos orígenes. */
export interface DiscountItem {
  source: 'service_log' | 'reservation';
  id: string;
  date: Date;
  userName: string | null;
  clientLabel: string | null;
  serviceLabel: string | null;
  catalog: number;
  charged: number;
  /** Negativa cuando se cobró de menos. Es el signo que importa. */
  difference: number;
  reasonCode: string | null;
  reasonLabel: string | null;
  note: string | null;
}

export interface DiscountGroup {
  code: string | null;
  label: string;
  name: string;
  total: number;
  count: number;
}

export interface DiscountReport {
  /** Sólo lo regalado. Un recargo no lo compensa. */
  totalGivenAway: number;
  byReason: DiscountGroup[];
  byUser: DiscountGroup[];
  items: DiscountItem[];
}
```

El resto sigue el patrón exacto de `useRangeReport` en `use-reports.ts`:
`getDiscounts(from, to)` en `ReportRepository`, su implementación en
`ApiReportRepository` mapeando snake_case a camelCase (`total_given_away` →
`totalGivenAway`, `date` → `new Date(...)`), y

```ts
export function useDiscountReport(from: string, to: string) {
  const repo = useRepository('report');
  return useQuery({
    queryKey: ['reports', 'discounts', from, to],
    queryFn: () => new GetDiscountReportUseCase(repo).execute(from, to),
  });
}
```

- [ ] **Step 2: The section**

`discounts-section.tsx`, con esta jerarquía y nada más:

1. **El titular**: «Dejado de cobrar» y el monto, en el tamaño de las otras
   cifras grandes del reporte. Es el control; todo lo demás es evidencia.
2. **Por motivo**: filas `label · total · count`, ordenadas por total.
3. **Por quién**, sólo cuando hay más de una persona: la comparación entre
   cajeros es lo que delata, y con una sola persona la sección es ruido.
4. **El detalle**: fecha y hora, quién, cliente, servicio, `catálogo → cobrado`,
   diferencia en rojo, motivo, y la nota cuando es «Otro».

Usá el mismo `Intl.NumberFormat('es-EC', …)` que el resto — coma decimal — y
`date-fns` con locale `es` para la fecha con hora, como en la ficha de deuda.

**Vacío**: cuando no hay descuentos, una línea sola —«Ningún precio se apartó
del catálogo en este rango.»— y nada más. Es la respuesta buena y no merece
una ilustración.

- [ ] **Step 3: Wire it into the page**

En `reports/page.tsx`, renderizá `<DiscountsSection from={from} to={to} />`
debajo del bloque de métodos de pago, usando el mismo rango de fechas que ya
maneja la página.

- [ ] **Step 4: Typecheck and build**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run build`
Expected: ambos verdes. Correlos hasta el final.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/domain/entities/discount-report.ts \
        apps/admin-v2/src/application/use-cases/reports/ \
        apps/admin-v2/src/domain/repositories/report.repository.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-report.repository.ts \
        apps/admin-v2/src/presentation/hooks/use-reports.ts \
        apps/admin-v2/src/presentation/components/features/reports/discounts-section.tsx \
        "apps/admin-v2/src/presentation/app/(tenant)/reports/page.tsx"
git commit -m "feat(descuentos): the owner reads what was given away, by reason and by person"
```

---

### Task 7: Verificación

**Files:** ninguno.

- [ ] **Step 1: Full backend suite**

Run: `cd apps/backend && composer test`
Expected: **exactamente los 9 fallos pre-existentes**. 25 tests nuevos: 4 (`PriceChangeReasonTest`) + 9 (`DiscountAtCounterTest`) + 4 (`ReservationOverrideReasonTest`) + 8 (`DiscountReportTest`).

En **SQLite** los 8 del reporte se saltean: el verde va de 521 a **538**, y los saltados de 19 a **27**. Los 546 completos sólo se ven en la corrida de MySQL del paso siguiente. Anotá los números reales.

- [ ] **Step 2: The MySQL-only suites**

```bash
cd apps/backend
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS turnly_test; CREATE DATABASE turnly_test;"
DB_CONNECTION=mysql DB_DATABASE=turnly_test php artisan migrate --force
DB_CONNECTION=mysql DB_DATABASE=turnly_test ./vendor/bin/pest tests/Feature/Report/ tests/Feature/Pricing/ tests/Feature/Reservation/
mysql -h127.0.0.1 -uroot -e "DROP DATABASE turnly_test;"
```
Expected: verde, sin saltados.

- [ ] **Step 3: Migrations from scratch**

```bash
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS turnly_scratch; CREATE DATABASE turnly_scratch;"
DB_DATABASE=turnly_scratch php artisan migrate:fresh
mysql -h127.0.0.1 -uroot -e "DROP DATABASE turnly_scratch;"
```
Expected: limpias. **Sin `--seed`**: el seeder está roto de antes.

- [ ] **Step 4: Admin builds**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run build`

- [ ] **Step 5: La escena del dueño, en el navegador**

Con el stack levantado, **entrando como cajero**:

1. Registrá un servicio de catálogo **$15** y dejá el precio en $15: **no aparece ningún selector de motivo**. El caso normal no puede pedir nada.
2. Bajá el precio a **$12**: aparece el bloque ámbar con los cinco motivos.
3. Intentá confirmar sin elegir: el botón está deshabilitado.
4. Elegí **Otro** sin escribir nota: sigue deshabilitado.
5. Escribí «amigo del dueño» y confirmá: entra.
6. Abrí el detalle del servicio: la bitácora muestra `price_changed` con catálogo $15, cobrado $12 y el motivo.
7. Subí un precio **por encima** del catálogo en otro registro: también pide motivo.

Ahora **entrando como dueño**:

8. Registrá otro a **$13** sin tocar nada más: entra sin pedir motivo.
9. Andá a **Reportes → Descuentos**: el titular dice **«Dejado de cobrar $X»**, con $3 en «Otro», y el descuento del dueño aparece con **«Sin motivo»**.
10. La sección **por quién** compara cajero contra dueño.

- [ ] **Step 6: El cajero no lee el reporte**

Entrá como cajero a `/reports`: la sección de descuentos **no aparece** (y el endpoint responde 403). Un reporte de descuentos visible para quien los hace no controla nada.

- [ ] **Step 7: Report**

Contá qué pasó en cada paso, con el número de tests del paso 1 y las cifras del reporte del paso 9.

---

## Notas de ejecución

**Rama.** Esta feature se apoya en las cuatro fases del libro de pagos, sin desplegar en `feat/registro-bitacora-asignados`. Seguí ahí salvo que el usuario decida otra cosa.

**Acción pendiente del usuario, fuera de este plan.** Revisar la matriz de permisos del tenant de producción: si alguien concedió `Precio` al Cajero, hoy el bloqueo está desactivado y el hurto descrito sí puede ocurrir. Después de esta feature ya no importa tanto —el privilegio pasa a significar «sin motivo»— pero conviene saberlo.

**Lo que este plan deliberadamente NO hace:**
- Tarifas por cliente. El usuario la descartó por tamaño. Este diseño no la bloquea.
- Límite de descuento por rol o monto. Un tope invita a quedarse justo debajo.
- Motivos configurables por tenant. Ver el spec.
- Tocar `update()` de service-logs, que edita `price_charged` suelto sin líneas. Ver Task 2 Step 6.

**El riesgo que esta feature asume, y conviene repetir.** El cajero puede elegir «cliente frecuente» en un descuento inventado y seguir robando. Nada de esto lo impide. Lo que hace es dejar el hecho con nombre, monto, hora y razón declarada — y un robo sostenido deja patrón visible en la primera pantalla del reporte.
