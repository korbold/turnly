# Business Resources — Pendientes

Continuación de `2026-06-18-business-resource-auto-assign.md`. Feature deployed a `develop`.

## Pendiente 1: `exists:` validation sin scope de tenant

**Archivo:** `apps/backend/app/Infrastructure/Http/Requests/Reservation/CreateReservationRequest.php`

**Problema:** Validación actual acepta `business_resource_id` de cualquier tenant.
```php
// actual
'business_resource_id' => ['nullable', 'uuid', 'exists:business_resources,id'],
```

**Fix:**
```php
// correcto
'business_resource_id' => ['nullable', 'uuid', 'exists:business_resources,id,tenant_id,' . app('current_tenant_id')],
```

**Impacto:** Bajo. Usuario necesita estar autenticado. La reserva queda con FK de otro tenant pero TenantScope evita que ese tenant vea la reserva. Bug de integridad de datos, no leak.

---

## Pendiente 2: `PublicController::book()` no usa `CreateReservationUseCase`

**Archivo:** `apps/backend/app/Infrastructure/Http/Controllers/PublicController.php` (~línea 456)

**Problema:** Bookings desde Flutter crean `ReservationModel` directamente — auto-assign de `business_resource_id` nunca ocurre para clientes.

**Opciones de fix:**
- A) Refactorizar `PublicController::book()` para llamar `CreateReservationUseCase`
- B) Extraer lógica de auto-assign a `BusinessResourceAssigner` service, llamarlo desde ambos lugares

**Impacto:** Alto cuando tenants usen recursos activamente. Por ahora ningún tenant tiene estaciones configuradas en producción. Urgente antes de que algún tenant configure recursos y espere auto-assign en el app.

---

## Contexto de commits

- `d4a57dc` — data layer (migration, entity, DTO, repo)
- `7a5ba36` — auto-assign logic + 5 tests
- `e6a202a` — frontend entity + mapper
- `5a8926b` — fix client-selection double-booking
- `265f3b4` — fix FQCN style
