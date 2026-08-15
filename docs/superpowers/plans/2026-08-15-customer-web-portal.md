# Portal del cliente en web (`/app`)

**Fecha:** 2026-08-15
**Motivo:** Google Play exige prueba cerrada con 12 testers × 14 días antes de
producción (vamos 6). Los clientes Android no tienen forma de registrarse ni
gestionar sus reservas. La API ya soporta todo; falta la interfaz web.

## Decisiones tomadas

- **Ubicación:** mismo sitio, prefijo `/app`. Sin infraestructura nueva.
- **Acceso:** magic link (email) + Google. Sin contraseñas.
- **Paridad:** replicar la app Flutter (`apps/customer_v2`), no inventar flujo.

## Mapa Flutter → Web

| Flutter | Web | Estado |
|---|---|---|
| `/home` (explorar) | `/explorar` | ✅ existe |
| `/business/:slug` | `/{slug}` | ✅ existe (reserva como invitado) |
| `/legal/*` | `/terms`, `/privacy` | ✅ existe |
| `/login`, `/register` | `/app/login` | ❌ nuevo (el actual es del panel admin) |
| `/reservations` | `/app/reservas` | ❌ nuevo |
| `/reservations/:id` | `/app/reservas/[id]` | ❌ nuevo |
| `/profile` | `/app/perfil` | ❌ nuevo |
| `/resources` (+add, history) | `/app/vehiculos` | ❌ nuevo |
| `/notifications` | `/app/notificaciones` | ❌ nuevo |
| `/accept-terms`, `/verify-email` | dentro del flujo de acceso | ❌ nuevo |
| `/category/:type` | `/explorar?categoria=` | ❌ menor |
| `/onboarding` | — | no aplica en web |

## Endpoints (todos ya existen)

| Acción | Endpoint | Notas |
|---|---|---|
| Pedir magic link | `POST /auth/magic-link/request` | throttled |
| Verificar magic link | `POST /auth/magic-link/verify` | devuelve token |
| Google | `POST /auth/google` | requiere client id web |
| Mis reservas | `GET /client/reservations` | **sin** X-Tenant, cruza todos los negocios |
| Detalle | `GET /client/reservations/{id}` | |
| Cancelar | `PATCH /client/reservations/{id}/cancel` | pide motivo |
| Reprogramar | `PATCH /client/reservations/{id}/reschedule` | fase 2 |
| Mis vehículos | `GET/POST/PATCH/DELETE /client-resources` | **requiere** X-Tenant |
| Historial de vehículo | `GET /client-resources/{id}/history` | |
| Notificaciones | `GET /notifications`, `PATCH /notifications/{id}/read` | |
| Aceptar términos | `POST /auth/accept-terms` | |
| Eliminar cuenta | `DELETE /auth/account` | requisito de tiendas; mantenerlo |

## Fase 1 — MVP (núcleo)

1. **`/app/login`** — input de email → magic link; botón de Google. Estados:
   enviado, expirado, error.
2. **`/m/[token]`** — hoy solo intenta abrir la app nativa y cae a Play Store
   (que no está publicada): callejón sin salida en Android. Agregar
   "Continuar en el navegador" → `magic-link/verify` → guarda sesión → `/app`.
   La app nativa sigue teniendo prioridad si está instalada.
3. **`/app`** — próximas reservas + atajo a explorar negocios.
4. **`/app/reservas`** — lista dividida en próximas / pasadas, con estado.
5. **`/app/reservas/[id]`** — detalle, servicios, total, y **cancelar con
   motivo** (misma lista de motivos que Flutter). Actualización en vivo por
   Reverb, igual que el detalle del admin.
6. **`/app/perfil`** — datos, cerrar sesión, eliminar cuenta.
7. **Guard de rol** — `/app` solo para clientes; staff se redirige al panel.
   El interceptor de axios hoy manda a `/login` en un 401: dentro de `/app`
   debe mandar a `/app/login`.

## Fase 2

- `/app/vehiculos` (listar, agregar, historial) — recordar el X-Tenant.
- Reserva **autenticada** desde `/{slug}`: prellenar datos y reusar vehículos
  guardados en vez de pedirlos de nuevo.
- `/app/notificaciones` + campanita.
- Aceptar términos / verificación de email dentro del flujo.

## Fase 3

- PWA instalable: `manifest.json` y `sw.js` ya existen (se usan para el push
  del admin). Ajustar scope/íconos y agregar "Agregar a pantalla de inicio".
- Web push para recordatorios de reserva.

## Riesgos

- **Sesión compartida con el panel:** `authStorage` guarda token + tenant slug.
  El cliente no pertenece a un solo negocio: el slug debe viajar por contexto
  (al ver un negocio), no como estado global.
- **`verified.email`:** no colgar de ese middleware ninguna ruta del portal;
  ya rompió el flujo de reserva móvil una vez.
- **Rutas que chocan:** `/app` no debe colisionar con el grupo `(tenant)`.
