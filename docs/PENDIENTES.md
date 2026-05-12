# Pendientes Turnly

Última actualización: 2026-04-30

Lista de tareas conocidas pero no implementadas todavía. Ordenado por prioridad relativa.

## Auth / Onboarding

- [ ] **Email magic link verification al registrar tenant**
  - Scaffolding ya existe: `OnboardingController::verify` con TODO comentado, `tenant.status = 'pending'`, `activateTenant` use case.
  - Falta: tabla `email_verification_tokens` (o usar `email_verified_at` en tenant), `Mail\TenantVerificationMail`, link `https://goturnly.com/verify?token=...`, disparo en `AuthController::register`, página `/verify-pending` en admin-v2.
  - Usa el queue worker `turnly-queue` ya configurado en deploy.

- [ ] **Validación SRI/RUC reforzada en register**
  - Hoy validamos formato (mod-10/11) y consultamos SRI en el tab de facturación.
  - Considerar mover el lookup también al registro inicial para gatear creación de tenants ficticios.

## Pagos

- [ ] **Pasarela de pago**
  - Opciones: PayPhone (local EC), Kushki, Stripe (USD only).
  - Recomendado: PayPhone para tarjetas locales + transferencia.
  - Webhook confirma pago → activar plan tenant.

- [ ] **Webhook pago confirmado → email super_admin**
  - Cuando se confirma un pago, mandar email a `danny@lupio.dev` con: tenant id/slug, plan contratado, monto, datos fiscales (`tax_id_type`, `tax_id`, `legal_name`, `billing_email`, `billing_address`, `billing_phone`).
  - Esto permite emitir factura manual en el portal SRI mientras no integramos Datil.

- [ ] **Gate pre-upgrade: bloquear si `billing_profile` incompleto**
  - En el flujo de upgrade-plan, antes de pasar a la pasarela, verificar que el tenant tenga todos los campos billing.
  - Si falta algo → redirect/modal a `Settings → Facturación`.

- [ ] **Tabla `invoices` y registro histórico**
  - Aunque la factura sea manual al inicio, guardar referencias: `tenant_id`, `payment_id`, `payment_provider`, `total`, `iva`, `status`, `clave_acceso` (cuando exista), `pdf_url`, `xml_url`, `issued_at`.
  - Útil para reportes y para integrar Datil después sin migrar datos.

## Facturación electrónica (fase 2)

- [ ] **Integración Datil.co o lib open-source**
  - Cuando lleguemos a >10 facturas/mes el costo de Datil ($8/mes) se justifica.
  - Alternativa gratis: `darkphp/sri-laravel` u otra lib Composer EC. Más trabajo, más riesgo.
  - Pre-requisito legal: RUC propio activo + firma electrónica (.p12) + registro como emisor electrónico en SRI.

## Infra / Deploy

- [ ] **Vercel: GitHub App con acceso al repo `korbold/turnly`**
  - Hoy los deploys de admin-v2 son manuales (`vercel --prod`).
  - Pendiente: instalar Vercel GitHub App en el repo, luego `vercel git connect` para auto-deploy.

- [ ] **Decidir branching + dominios Vercel**
  - Opción A: este proyecto Vercel sigue siendo dev, production branch = `develop`, dominio cambia a `admin.dev.goturnly.com`. Crear segundo proyecto para prod (main + `admin.goturnly.com`).
  - Opción B: production branch sigue `main`, develop = preview deploys con branch alias `admin.dev.goturnly.com`.

- [ ] **CI workflow `deploy-dev.yml` actualmente solo deploya backend**
  - Considerar agregar un step para buildear/desplegar admin-v2 si Vercel auto-deploy no se configura.
  - customer_v2 (Flutter) no se deploya en server; lo recompila el desarrollador con `--dart-define=ENV=dev`.

## customer_v2 (Flutter)

- [ ] **Reemplazar URL hardcoded de fallback en `api_client.dart`**
  - Hoy `api_client.dart` usa `https://api.dev.goturnly.com/api/v1` como fallback si `dotenv` no carga.
  - Verificar que ese fallback siga válido cuando agreguemos `api.prod.goturnly.com`.

- [ ] **Pantalla de selección de tipo de negocio en customer_v2 (si aplica)**
  - Hoy customer_v2 es para clientes finales, no para owners. Confirmar si necesita seleccionar tipo de negocio o solo lo consume.

## claude-mem

- [ ] **Re-evaluar valor de claude-mem tras 2 semanas**
  - DB y chroma reseteados el 2026-04-30. Ya tenemos worker corriendo con `uvx` instalado.
  - Si después de 2 semanas la memoria semántica no aporta valor real al flujo de trabajo, considerar deshabilitar el plugin (`enabledPlugins.claude-mem = false` en `~/.claude/settings.json`).
