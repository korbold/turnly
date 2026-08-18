# Registro Diario: lavador, secador y bitácora del servicio

**Fecha:** 2026-08-18
**Estado:** diseño aprobado, pendiente de plan de implementación
**Alcance:** `apps/backend`, `apps/admin-v2`

## Problema

Un dueño de vehículo reclama tres semanas después: "me rayaron la puerta".
Hoy no hay forma de saber quién lavó ese auto. `service_logs.attended_by`
guarda una sola persona, y cuando el que registra es cajero el backend la
sobreescribe con el cajero mismo (la regla anti-fraude de comisiones en
`resolveAttendedBy`), así que en una lavadora el campo no dice quién trabajó:
dice quién cobró.

Tampoco hay rastro de lo que le pasó al servicio. Se cobró, se completó, se
facturó — nada de eso deja huella con autor y hora. Si alguien corrige un dato
después de que entró el reclamo, no queda escrito.

El objetivo **no** es pago por lavado. Es tener un historial defendible de quién
hizo el trabajo y qué se le hizo al registro.

## Decisiones tomadas

Las cinco preguntas que definieron el diseño, con su respuesta:

| Pregunta | Decisión |
|---|---|
| ¿Lavadores y secadores son usuarios de la app? | **No.** Catálogo de nombres, sin cuenta ni login. |
| ¿Qué rubros? | **Solo `car_wash`.** El resto sigue con un "Empleado". |
| ¿Cuándo se exigen? | Opcionales al registrar, **obligatorios para completar**. |
| ¿Quién corrige después de completado? | **Solo admin/owner.** El cajero puede mientras está en progreso. |
| ¿Hasta cuándo registra la bitácora? | **Siempre.** Append-only, incluida la facturación posterior. |

El catálogo de nombres es lo que resuelve el conflicto con el pin: si el lavador
no es un usuario, `attended_by` no se toca, la regla anti-fraude sigue viva y
ningún test existente cambia.

## Modelo de datos

### `service_staff` — el catálogo

```
id          uuid pk
tenant_id   uuid  fk tenants, index
name        string(120)
position    enum('washer','dryer','both')
is_active   boolean default true
timestamps
```

Nombre genérico a propósito: mañana una barbería querrá barbero/ayudante con la
misma forma, y `wash_staff` obligaría a una tabla nueva. Las etiquetas en
español viven en la UI.

**Sin borrado.** Solo `is_active`. Un lavador que renunció hace seis meses tiene
que seguir apareciendo en el servicio que hizo — es exactamente el caso de uso.
El endpoint DELETE no existe; la UI ofrece activar/desactivar.

### `service_logs` — dos columnas

```
washed_by   uuid nullable  fk service_staff, restrictOnDelete
dried_by    uuid nullable  fk service_staff, restrictOnDelete
```

`attended_by` **no se toca**: ni su tipo, ni su nullability, ni el pin que la
gobierna. Sigue significando "quién atendió/registró".

`restrictOnDelete` es coherente con "sin borrado": si algún día se agrega un
DELETE, la base lo frena antes de romper el historial.

### `service_log_events` — la bitácora

```
id              uuid pk
tenant_id       uuid  fk tenants, index
service_log_id  uuid  fk service_logs, cascadeOnDelete, index
event           string(40)
detail          json nullable
actor_id        uuid nullable  fk users        -- null = sistema (SRI)
created_at      timestamp
```

Sin `updated_at`: una bitácora no se edita. `cascadeOnDelete` porque un registro
eliminado (privilegio Eliminar, solo si no está pagado ni facturado) se lleva su
propia bitácora — no hay nada que auditar de algo que no existe.

`detail` es json y no columnas tipadas porque cada evento carga una forma
distinta y ninguna consulta filtra por su contenido: la bitácora se lee siempre
por `service_log_id`, en orden cronológico.

## Taxonomía de eventos

Siete eventos. La regla para incluir uno: **¿un reclamo o una discusión de plata
se resuelve distinto si este dato existe?** Lo que no pasa ese filtro no entra —
una bitácora chatty no se lee, y una que no se lee no defiende nada.

| `event` | Se escribe en | `detail` | Se lee como |
|---|---|---|---|
| `created` | `store()` | `{}` | Registró el servicio |
| `assignee_changed` | `updateAssignees()` | `{position, from_id, from_name, to_id, to_name}` | Lavador: — → Federman Paspuel |
| `items_changed` | `updateItems()` | `{total_before, total_after}` | Cambió los servicios · $12,00 → $18,00 |
| `payment_recorded` | `recordPayment()` | `{method, bank, amount}` | Cobró $12,00 · Transferencia · Pichincha |
| `status_changed` | `complete()` | `{from, to}` | Completó el servicio |
| `invoice_requested` | `invoice()` | `{}` | Solicitó factura |
| `invoice_status_changed` | `EmitServiceLogInvoiceJob`, `SyncServiceLogInvoiceStatusJob` | `{from, to, reason?}` | Factura autorizada / rechazada: *motivo* |

Los nombres van **desnormalizados** en `detail` (`from_name`, `to_name`). Si el
catálogo se renombra después, la bitácora tiene que seguir diciendo lo que decía
el día del servicio: es el punto de tener una bitácora.

`actor_id` es nullable y queda en null para los dos eventos que dispara el SRI a
través de los jobs. La UI los muestra como "SRI" en vez de una persona.

### Escritor único

`App\Application\Services\ServiceLogEventRecorder`, un método por evento:

```php
$recorder->created(ServiceLogModel $log, ?string $actorId): void
$recorder->assigneeChanged(ServiceLogModel $log, string $position, ?ServiceStaffModel $from, ?ServiceStaffModel $to, ?string $actorId): void
$recorder->itemsChanged(ServiceLogModel $log, float $before, float $after, ?string $actorId): void
$recorder->paymentRecorded(ServiceLogModel $log, string $method, ?string $bank, float $amount, ?string $actorId): void
$recorder->statusChanged(ServiceLogModel $log, string $from, string $to, ?string $actorId): void
$recorder->invoiceRequested(ServiceLogModel $log, ?string $actorId): void
$recorder->invoiceStatusChanged(ServiceLogModel $log, ?string $from, string $to, ?string $reason): void
```

Métodos con nombre en vez de un `record(string $event, array $detail)` genérico:
el tipo de cada firma es lo que impide que dos llamadores escriban el mismo
evento con formas distintas de `detail`, que es la falla que vuelve inservible a
una bitácora seis meses después.

Cada llamada va **dentro de la transacción del cambio que describe**, donde ya
hay una (`updateItems`), o inmediatamente después de persistir. Un evento sin su
cambio miente; un cambio sin su evento es un hueco.

## Reglas de asignación

Dos gates, no uno. El estado del registro decide cuál aplica:

| Estado | Cajero | Admin / Owner | Lavador |
|---|---|---|---|
| `in_progress` | asigna y corrige | asigna y corrige | no |
| `completed` | **no** | corrige | no |

- **En progreso** lo gobierna un privilegio nuevo de la matriz, **`Asignados`**,
  con default `full` para Admin y Cajero, `none` para Lavador. Es la clase de
  decisión para la que existe la matriz.
- **Completado** es **regla fija, no configurable**: `owner` o `tenant_admin`.
  Si fuera una casilla, alguien podría devolvérsela al cajero y el rastro pierde
  el sentido que lo justifica. Es la única asimetría deliberada del diseño.

Completar exige los dos asignados y devuelve **422** si falta alguno. Solo en
`car_wash`: en los demás rubros ninguna de estas columnas se usa y el endpoint
se comporta igual que hoy.

## Backend

### Endpoints nuevos

```
GET    /service-staff              lista, ?active=1 para los vigentes
POST   /service-staff              crear
PATCH  /service-staff/{id}         renombrar, cambiar puesto, activar/desactivar
PATCH  /service-logs/{id}/assignees   {washed_by?, dried_by?}
```

Escritura del catálogo: `owner`/`tenant_admin`, el mismo criterio que
`TenantSettingsController::mayEditSettings`. Lectura: cualquier miembro — el
select del Registro Diario la necesita.

`updateAssignees` valida los dos gates, verifica que cada staff pertenezca al
tenant y esté activo, y escribe un `assignee_changed` por puesto que cambió — dos
eventos si cambiaron los dos, ninguno si el request no mueve nada.

### Cambios en endpoints existentes

- `POST /service-logs` — acepta `washed_by` y `dried_by` opcionales.
- `PATCH /service-logs/{id}/complete` — el gate de 422.
- `GET /service-logs/{id}` — devuelve `washed_by`/`dried_by` con el nombre
  resuelto, más la bitácora ordenada.
- `GET /service-logs` — el índice devuelve los dos nombres para la columna de la
  lista. **Sin** bitácora: son N filas y nadie la lee desde ahí.

### Eager loading

`index()` y `show()` cargan `washer` y `dryer`. `show()` agrega `events.actor`.
La lista ya sufrió N+1 antes; la relación entra en el `with()` existente.

## Admin

Todo lo que sigue se dibuja **solo si `businessType === 'car_wash'`**.

### Configuración → pestaña "Personal"

Novena pestaña, después de Recursos. Tabla: nombre, puesto, activo. Alta con un
input y un select — el punto de que no sean usuarios es que agregar uno sea
escribir un nombre, no cursar una invitación con contraseña.

### Nuevo servicio

El select "Empleado" **desaparece**; en su lugar Lavador y Secador, ambos
opcionales, filtrados por puesto (Lavador ofrece `washer` + `both`).

`attended_by` sigue siendo obligatoria en `CreateServiceLogRequest` y no se
toca, así que al desaparecer el select el modal manda **el id del usuario que
registra**. Para un cajero es lo que el pin ya escribía; para un admin pasa a
ser él mismo en vez del empleado que elegía, y ese dato se mudó a su columna
propia.

### Lista del día

La columna EMPLEADO muestra lavador arriba y secador debajo en gris. Sin
asignar se lee "Sin asignar" en muted, no un guión: es una tarea pendiente, no
un dato vacío.

Menú ⋯ gana **Asignar** → dialog compacto con los dos selects. Es la acción del
día (asigno al lavador cuando arranca, al secador cuando seca) y merece camino
propio en vez de abrir el editor completo.

**Completar** con asignados faltantes abre ese dialog en lugar de tirar el 422.
El error del backend es la red de seguridad, no la experiencia.

### Detalle del servicio

Dos tarjetas nuevas en la columna derecha, debajo de TIEMPOS:

```
ASIGNADOS
  Lavador   Federman Paspuel
  Secador   Luis Chalá                    [Cambiar]

BITÁCORA
  18 ago 15:09  Danny Barahona   Registró el servicio
  18 ago 15:11  Danny Barahona   Lavador: — → Federman Paspuel
  18 ago 15:52  Danny Barahona   Cobró $12,00 · Transferencia · Pichincha
  18 ago 15:53  Danny Barahona   Completó el servicio
  18 ago 16:04  Danny Barahona   Solicitó factura
  18 ago 16:04  SRI              Factura autorizada
```

`[Cambiar]` solo se dibuja si el rol puede en ese estado. TIEMPOS se queda: es
el resumen, la bitácora es el detalle.

### Página del vehículo

Las filas de la pestaña Servicios pasan a ser clickeables hacia
`/service-logs/{id}`. El `id` que ya trae cada fila es el del service log, así
que es un cambio de una línea y cero backend.

Eso cierra el circuito del reclamo: llega el dueño → se busca la placa → se abre
el vehículo → click en el servicio → qué se le hizo, qué se le vendió, quién
lavó, quién secó, y si alguien tocó algo después.

### Matriz de permisos

Tercera columna de privilegios, **Asignados**, junto a Precio y Eliminar bajo el
encabezado "Registro Diario". Ciclo de dos estados como las otras dos.

## Pruebas

**Backend (Pest).**

- Catálogo: CRUD, escritura solo owner/admin, lectura abierta a miembros, sin
  ruta de borrado, aislamiento entre tenants.
- Asignación: cajero asigna en progreso; cajero rechazado en completado; admin
  aceptado en completado; lavador rechazado con el default de la matriz, y
  aceptado en progreso si el owner le tilda `Asignados`; staff de otro tenant
  rechazado; staff inactivo rechazado.
- Completar: 422 sin lavador, 422 sin secador, OK con los dos, y **OK sin
  ninguno en un tenant que no es car_wash**.
- Bitácora: un evento por transición, dos `assignee_changed` cuando cambian los
  dos, ninguno cuando el request no mueve nada, `actor_id` null en los eventos
  de los jobs, nombres desnormalizados sobreviven al renombre del staff.
- Regresión: `CashierAttributionTest` sigue verde sin tocarse — es la prueba de
  que el pin quedó intacto.

**Local.** Se levanta el stack y el usuario prueba el flujo completo antes del
deploy: registrar sin asignar, asignar en progreso, intentar completar
incompleto, completar, intentar corregir como cajero, corregir como admin,
facturar, y leer la bitácora desde la placa del vehículo.

## Fuera de alcance

- **Pago por lavado / comisiones.** Los reportes no agrupan por empleado
  todavía. Las columnas nuevas lo dejan servido para después, pero no se
  construye ahora.
- **Otros rubros.** La tabla es genérica, la UI es car_wash. Extenderla es una
  decisión aparte.
- **Bitácora en reservas.** El mismo problema existe del otro lado; este spec no
  lo toca.
- **Límite de plan.** Este personal no cuenta contra `max_employees` porque no
  son cuentas. Que el mercado cobre por empleado y Turnly no es una decisión
  comercial pendiente, no un cambio de este trabajo.
