# Continuar — sesión 2026-05-01

## Lo que quedó funcionando hoy

### Bugs fijados live en `dev.goturnly.com`

- **500 al reenviar OTP** → instalado `resend/resend-laravel` (composer). `MAIL_MAILER=resend` ya estaba en `.env` server pero faltaba el paquete.
- **404 `/icons/icon-192.png`** → generados `icon-192.png` y `icon-512.png` en `apps/admin-v2/public/icons/`.
- **A11y warning OTP inputs** → agregados `id`, `name`, `aria-label` por dígito en `verify-email/page.tsx`.
- **Fecha trial mostraba `5/14/2026`** → forzado `toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })` en `plan/page.tsx`.
- **Trial 14d → 30d** en 3 call sites: `RegisterTenantUseCase.php`, `AuthController.php`, `TenantModelFactory.php`. Tenant existente `feder` actualizado en DB.
- **Email en URL `?email=...`** → reemplazado con `sessionStorage.pendingVerifyEmail`. No leak a logs/Referer/historial.
- **`Network Error` en login** → `NEXT_PUBLIC_API_URL` en Vercel estaba en blanco (PATCH a env tipo `sensitive` no actualiza valor). Recreado como `plain` con `https://api.dev.goturnly.com/api/v1`.

### Infra

- **Git author corregido** → `korbold@live.com` (era `dbarahona@ec.krugercorp.com` Kruger, Vercel rechazaba deploys).
- **CI split**:
  - `.github/workflows/deploy-dev.yml` → backend Vultr, scoped a `apps/backend/**`
  - `.github/workflows/deploy-dev-admin.yml` → admin-v2 Vercel + alias `dev.goturnly.com`, scoped a `apps/admin-v2/**`
- **Vercel git nativo desconectado** (project link) — para evitar conflicto con GH Actions. `rootDirectory` = null.
- **Secrets GitHub agregados:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

### Decisiones marketing/producto

- **Estrategia trial:** Premium gratis 30 días (no Free directo). Backend ya implementa: durante trial todos los limits = ilimitados; después cae a Free real automático.
- **Founders pricing acordado** (en memoria): primeros 5-10 clientes mantienen precio reducido permanente.
- **Plan táctico primeros pilotos:** demo presencial → activar trial → seguimiento WhatsApp día 7/14/25 → cierre día 28-30.

## Tareas para mañana

### P0 — UX trial (la prioridad)

- [ ] **Banner trial activo en dashboard.** Mostrar arriba en `/dashboard`: "Estás usando Premium gratis. Te quedan X días." Botón "Mantener Premium" → `/plan`. Solo si `is_trial=true && trial_ends_at > now()`.
- [ ] **Email scheduled trial nudge.** Comando artisan `php artisan trial:nudge` que corre vía cron diario; manda email a tenants con trial activo el día 7, 14, 25, 28. Plantillas: bienvenida-features, mostrar-reportes, ofrecer-founders, último-aviso.
- [ ] **Tenant page (super-admin) — fila trial.** Mostrar `días restantes` calculado con `Math.round` no `Math.ceil` (ahora muestra +1 al registrar).

### P1 — Founders pricing

- [ ] **Coupon `founders50`** en backend. Tabla `coupons` (code, discount_percent, max_uses, valid_until). Aplicar en upgrade flow.
- [ ] **UI coupon en `/plan`** — campo "tienes un código?" antes de pagar.

### P2 — Pendiente del PENDIENTES.md

- [ ] Pasarela pago (PayPhone). Webhook confirma → activar plan.
- [ ] Gate pre-upgrade: bloquear si `billing_profile` incompleto.
- [ ] Validación SRI/RUC en register (no solo en facturación).

### Limpieza CI

- [ ] Migrar `actions/checkout@v4` y `actions/setup-node@v4` a v5 cuando salgan (deprecation Node.js 20, deadline 2026-09-16).
- [ ] El workflow `Deploy Dev (admin-v2)` muestra annotation `process git failed exit 128` no-fatal — investigar; probablemente algún step interno de `vercel build` que no afecta resultado.

### Notas técnicas

- **Vercel rootDirectory:** dejado en `null` porque el workflow ya hace `working-directory: apps/admin-v2`. Si reconectas Vercel git nativo, builds van a fallar con `vercel-build script missing` — re-disconnect via API.
- **Vercel env vars:** NUNCA marcar `NEXT_PUBLIC_*` como `type: sensitive` en API. PATCH no actualiza el valor (solo metadata) y `vercel pull` baja string vacío. Usar `type: plain`.
- **Git config repo:** `git config user.email "korbold@live.com"` ya seteado localmente. Verificar en cada checkout fresco si el clone trae config global Kruger.
- **Token Vercel actual:** sin expiración, scope team `Danny's projects`. Está en GitHub secret `VERCEL_TOKEN`. Si se rota: `echo TOKEN | gh secret set VERCEL_TOKEN`.

### Estado actual servicios

- **Vultr `45.32.169.172`** (dev backend): LEMP + queue worker `turnly-queue` + cron + GH Actions deploy desde `develop`.
- **Vercel `turnly-admin`**: deploys manejados por GH Actions; `dev.goturnly.com` aliased a último deploy READY.
- **Resend**: dominio `goturnly.com` enviar como `noreply@goturnly.com`. Verificar DKIM/SPF status si emails caen en spam.
