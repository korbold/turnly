# Flutter Business Resource Picker — Design Spec

**Date:** 2026-06-19  
**Feature:** Step de selección de recurso (barbero/estación/sala) en el wizard de reserva del app Flutter.

---

## Context

Backend ya soporta `business_resources` (estaciones, sillas, salas) y el setting `allow_client_resource_selection`. Cuando ese setting es `true`, el cliente puede elegir su barbero/terapeuta/sala preferido durante el booking. El app Flutter actualmente no expone esta funcionalidad — envía siempre `business_resource_id: null`.

---

## Goal

Insertar un step dedicado en el wizard de reserva que muestre los recursos activos del negocio cuando `allow_client_resource_selection = true`. El cliente elige quién/qué atiende su reserva. El step se omite completamente cuando el negocio no usa esta feature.

---

## Architecture

### Backend changes (2 métodos en `PublicController`)

**1. `getTenant` (`GET /public/tenants/{slug}`)**

Agregar al response:
```json
{
  "settings": {
    "allow_client_resource_selection": true
  },
  "business_resources": [
    {
      "id": "uuid",
      "name": "Silla Juan",
      "type": "person",
      "employee": {
        "name": "Juan Pérez",
        "photo_url": "https://..."
      }
    },
    {
      "id": "uuid",
      "name": "Estación 1",
      "type": "physical",
      "employee": null
    }
  ]
}
```

Solo recursos activos (`is_active = true`), ordenados por `sort_order`, luego `name`. `employee` null cuando `employee_id` es null o el usuario no tiene foto.

**2. `getAvailableSlots` (`GET /public/tenants/{slug}/available-slots`)**

Aceptar parámetro opcional `business_resource_id: uuid`.

Cuando viene, reemplazar la query de reservas existentes por una filtrada para ese recurso:
```php
$existingReservations = ReservationModel::query()
    ->forTenant($tenant->id)
    ->whereDate('scheduled_at', $request->date)
    ->where('business_resource_id', $request->business_resource_id)
    ->whereNotIn('status', ['cancelled', 'no_show'])
    ->get();
```

La disponibilidad por slot es binaria (0 o 1) cuando se filtra por recurso: si el recurso tiene alguna reserva que solapa el slot, `available = 0`.

Cuando `business_resource_id` no viene, comportamiento actual sin cambios.

### Flutter changes

**Nuevos archivos:**
- `explore/domain/entities/business_resource.dart`

**Archivos modificados:**
- `explore/domain/entities/business.dart`
- `explore/data/dtos/business_dto.dart`
- `reservations/presentation/cubit/create_reservation_cubit.dart`
- `reservations/presentation/cubit/create_reservation_state.dart`
- `reservations/presentation/screens/create_reservation_screen.dart`
- `reservations/data/repositories/reservation_repository_impl.dart`

---

## Domain Entity

```dart
// explore/domain/entities/business_resource.dart
class BusinessResource {
  final String id;
  final String name;
  final String type; // 'physical' | 'person'
  final String? employeeName;
  final String? employeePhotoUrl;
}
```

`Business` entity additions:
```dart
final bool allowClientResourceSelection;
final List<BusinessResource> businessResources;
```

---

## Wizard Flow

```
allow_client_resource_selection = true && businessResources.isNotEmpty
  → [Vehículo?] → [Recurso] → [Fecha/Slot] → [Confirmar]

allow_client_resource_selection = false || businessResources.isEmpty
  → [Vehículo?] → [Fecha/Slot] → [Confirmar]   ← comportamiento actual
```

Step indicator se actualiza dinámicamente — ya soporta 2, 3 y 4 steps.

---

## Resource Picker Step UI

**Layout:** Grid 2 columnas, scroll vertical.

**Primera card siempre:** "Sin preferencia" — avatar con ícono genérico (persona con signo de interrogación), envía `business_resource_id: null` → backend auto-asigna.

**Cards de recurso:**
- Avatar circular: foto del empleado si `employeePhotoUrl != null`, iniciales del nombre si no
- Nombre centrado debajo del avatar
- Al seleccionar: borde del color brand del tenant, fondo tenue

**Botón "Siguiente":** deshabilitado hasta que el cliente toque una card (incluida "Sin preferencia").

---

## Cubit Changes

```dart
// Nuevo campo en cubit (no en state sealed class — es navigation data)
String? _selectedBusinessResourceId; // null = sin preferencia elegida o no aplica
bool _resourceStepCompleted = false;

void selectBusinessResource(String? id) {
  _selectedBusinessResourceId = id;
  _resourceStepCompleted = true;
  // No emite estado nuevo — UI reacciona a PageController
}
```

`loadSlots` acepta `businessResourceId` opcional y lo pasa al repositorio:
```dart
Future<void> loadSlots(String date, String serviceId, {String? businessResourceId})
```

`createReservation` incluye `businessResourceId: _selectedBusinessResourceId`.

---

## API Changes (Flutter)

**Available slots query:**
```
GET /public/tenants/{slug}/available-slots
  ?date=2026-06-19
  &service_id=...
  &business_resource_id=<id-or-omitted>
```

**Booking body** (additions to existing):
```json
{
  "business_resource_id": "uuid-or-null"
}
```

---

## Error Handling

| Error | Causa | Mensaje al usuario |
|---|---|---|
| 409 `NO_RESOURCE_AVAILABLE` | Recurso ocupado en ese slot | "Este recurso ya no está disponible para ese horario. Elige otro horario o selecciona sin preferencia." |
| Red sin respuesta | Timeout | Mensaje genérico existente |

El 409 lleva al usuario de vuelta al step de fecha (no al step de recurso) — el recurso elegido sigue seleccionado.

---

## Conditional Logic Summary

```dart
bool get _showResourceStep =>
    widget.business.allowClientResourceSelection &&
    widget.business.businessResources.isNotEmpty;
```

Si `_showResourceStep = false`, `_selectedBusinessResourceId` nunca se setea → booking se envía sin `business_resource_id` → backend auto-asigna (comportamiento actual).

---

## Out of Scope

- Mostrar foto de empleado en la card de confirmación (solo nombre del recurso)
- Filtrar servicios por recurso (un barbero que solo hace ciertos cortes)
- Recursos deshabilitados en tiempo real (si se agotan durante la sesión, el 409 lo cubre)
