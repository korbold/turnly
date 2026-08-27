# Un lugar donde romper cosas

**Fecha:** 2026-08-26
**Diseño cerrado:** 2026-08-20
**Estado:** spec listo para implementar — bloqueado por credenciales (ver el final)
**Alcance:** sub-proyecto 1, el ambiente. Los E2E son el sub-proyecto 2 y necesitan que esto exista primero.

## El problema

No hay ambiente intermedio. El box de dev (`45.32.169.172`) se dio de baja el
2026-08-15 y prod es el único vivo. El workflow `deploy-dev.yml` sigue en el
repo con su trigger comentado y esta nota encima:

```yaml
# The dev box (45.32.169.172) is decommissioned as of 2026-08-15 and
# prod is the only live environment, so the push trigger is off
```

La consecuencia se midió sola. Los tres bugs de `fix/decimales-y-venta-producto`
—venta de mostrador sin cliente, decimales que entraban como `2425` en vez de
`4.25`, y el diálogo de edición que reenviaba productos como servicios y rompía
la FK con un 500 silencioso— aparecieron **al abrir el navegador**, con el plan
aprobado y los tests verdes. Los tests de Pest no los vieron porque SQLite no
aplica claves foráneas y porque nadie tecleó en un `<input>`.

Sin un lugar donde ejercitar la UI, cada rama grande es una apuesta que se
cobra en prod, en horario laboral, con cajeros registrando servicios.

## El principio que ordena todo

> **Mismo camino de código, destino en sandbox.**

Fidelidad significa que se ejecuta el mismo código, no uno parecido. Seguridad
significa que lo que sale no llega ni al mundo real ni a prod.

De ahí una regla que corrige dos recomendaciones previas mías: **apagar una
integración no prueba nada**. Habíamos propuesto `MAIL_MAILER=log` y sacar la
facturación de staging. Las dos estaban mal: un staging que difiere justo en la
pieza que se rompe da confianza falsa. El correo y la facturación **van**, con
remitente y ambiente aislados.

## La topología

Medida contra prod por SSH el 2026-08-20 y reconfirmada hoy.

| | prod | staging |
|---|---|---|
| Proveedor / región | Vultr **MIA** | Vultr **MIA** |
| Hostname | `turnly-prod` | `turnly-staging` |
| Forma | 2 vCPU / 3910 MB / 75 GB (`vc2-2c-4gb`, $22,30/mes) | **1 vCPU / 2 GB ($10/mes)** |
| OS | Ubuntu 24.04.4 LTS | idéntica |
| PHP / MySQL | 8.3.31 / 8.0.46 | idénticos |
| API | `api.goturnly.com` | `api.staging.goturnly.com` |
| Admin (Vercel) | `turnly-admin-prod` → `goturnly.com` | reciclar `turnly-admin` → `staging.goturnly.com` |
| Rama | `main` | `develop` |

Todo igual que prod salvo la RAM, y esa excepción está medida. Prod usa **1084
MB de 3910 (28%)**, 9.4 GB de 75 de disco, con load average 0.02 tras 34 días de
uptime. El stack completo —MySQL (el más pesado, 6,8%), php-fpm, Reverb, dos
colas y el billing con `artisan serve`— cabe en 1,1 GB. Un plan de 2 GB deja
casi el doble de lo que prod consume hoy, con carga sintética encima.

Lo único que se sacrifica es headroom que nadie usa. Mismo OS, mismo PHP, mismo
MySQL, mismo nginx, mismas units, mismo código: las dimensiones donde un staging
miente de verdad quedan intactas.

**Co-hospedar staging en el box de prod queda descartado**, aunque ahorre los
$10. Pondría un sandbox sobre la misma instancia de MySQL donde vive
`turnly_prod`: un `staging:seed` apuntado a la base equivocada —justo el tipo de
bug que este ambiente existe para atrapar— borraría datos reales. Y elimina la
prueba 7, que es la mitad del valor de todo esto.

`develop` hoy está **12 commits detrás de `main` y no tiene nada propio**: se
pone al día con un fast-forward, sin conflictos.

## Reparto de capas

Terraform **no es** una herramienta de deploy. Tres capas, tres herramientas:

| Capa | Herramienta | Qué hace |
|---|---|---|
| Provisión | Terraform | ssh key, firewall, instancia, registro DNS |
| Bootstrap | cloud-init (`user_data`) | php8.3 + extensiones, nginx, mysql, redis, units, `.env` esqueleto |
| Deploy | GitHub Actions | código, `composer install`, migraciones, caches, restart |

Proveedores confirmados en el registry: **`vultr/vultr` v2.32.0** (2026-07-14) y
**`cloudflare/cloudflare` v5**, donde el recurso es `cloudflare_dns_record`
—renombrado desde `cloudflare_record`— y el campo es `content`, no `value`.

**Trampa de `vultr_instance`:** cambiar `hostname` **fuerza reinstalación del
OS**, no un update. Un `terraform apply` distraído puede borrar el box.

## Lo que Terraform declara, y lo que jamás

Vive en `infra/staging/`, fuera de `apps/backend/**` (ver Riesgos).

```
infra/staging/
  main.tf          vultr_ssh_key, vultr_firewall_group + rules,
                   vultr_instance, cloudflare_dns_record
  variables.tf     api keys por env var, nunca en el state
  cloud-init.yaml  user_data
  outputs.tf       ip pública
```

Tres guardas que no son negociables:

1. **Prod nunca entra al state.** El camino a IaC no es `terraform import`
   —adivinar el estado de algo hecho a mano, con un `plan` desalineado que
   puede proponer *replace* del servidor de producción—. Es: construir staging
   con este código, comprobar que levanta un box que funciona, **reconstruir
   prod desde ese mismo código** en una instancia nueva, migrar la base, cortar
   DNS cuando ya responde, y apagar la vieja días después. De regalo queda un
   procedimiento de recuperación ante desastre que fue probado de verdad.

2. **Un `cloudflare_dns_record`, jamás un recurso de zona.** La zona es la misma
   de prod y Cloudflare no acota tokens a un registro. Si `api.goturnly.com`
   deja de resolver, todos los tenants pierden la API al instante. Leer el
   `plan` antes de cada `apply`, siempre.

3. **Los secretos los escribe GitHub Actions, no Terraform.** Una variable de
   Terraform queda en texto plano en el state.

State local + gitignore para empezar. Vultr Object Storage es S3-compatible si
algún día hace falta backend remoto.

## cloud-init

Replica la anatomía medida de prod. Lo esencial:

**Extensiones PHP** — las del box de prod. Tres son obligatorias por el SRI:
`soap`, `xsl`, `openssl`. **Sin `soap` el billing no arranca.**

**Units systemd**, con sus usuarios distintos, que no es un detalle cosmético:

```ini
# turnly-queue     User=deploy    Group=deploy    Restart=always
ExecStart=/usr/bin/php artisan queue:work --queue=default --sleep=3 --tries=3 --max-time=3600

# turnly-reverb    User=www-data  Restart=always
ExecStart=/usr/bin/php artisan reverb:start --host=0.0.0.0 --port=8080

# billing          User=www-data
ExecStart=/usr/bin/php artisan serve --host=127.0.0.1 --port=8100

# billing-queue    User=www-data
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --max-time=3600
```

El billing corre con `artisan serve` —el servidor de desarrollo de PHP— en vez
de php-fpm. Es deuda técnica observada en prod, **no se corrige aquí**: staging
replica prod, no lo mejora. Corregirla es otro trabajo, y hacerlo primero en
staging es exactamente para lo que staging sirve.

**nginx**: `server_name api.staging.goturnly.com`, php por
`unix:/var/run/php/php8.3-fpm.sock`, `fastcgi_read_timeout 60s`, y los dos
`location` de websockets (`/app` y `/apps`) haciendo proxy a `127.0.0.1:8080`
con `Upgrade`/`Connection`, `proxy_buffering off` y timeouts de 86400. El puerto
8080 de Reverb **no se expone**: entra por nginx.

**`certbot` no va en cloud-init.** Corre antes de que propague el DNS y falla.
Lo emite el workflow, en un paso idempotente.

**`BILLING_SERVICE_URL` no se define.** En prod no está en el `.env` del backend:
cae al default `http://localhost:8100` de `config/services.php` y funciona porque
el billing es co-inquilino del mismo box. Staging mantiene esa forma. Inventar
una URL es introducir una diferencia.

## El workflow de deploy

`.github/workflows/deploy-staging.yml`, calcado de `deploy-dev.yml` con el
trigger vivo:

```yaml
on:
  push:
    branches: [develop]
    paths:
      - 'apps/backend/**'
      - '.github/workflows/deploy-staging.yml'
```

Del template se conserva un paso que parece trivial y no lo es:

```bash
# PHP-FPM runs as www-data and needs to read .env. Without this,
# Laravel silently falls back to config defaults (sqlite/database)
# and HTTP requests 500 while CLI keeps working.
chgrp www-data .env && chmod 640 .env
```

Y se agrega una aserción **antes** de cualquier migración:

```bash
grep -q '^SRI_AMBIENTE=1' /var/www/billing/.env || { echo "billing NO está en pruebas"; exit 1; }
[ "${BILLING_SERVICE_URL:-http://localhost:8100}" = "http://localhost:8100" ] || { echo "billing apunta afuera"; exit 1; }
```

Aserción, no convención. Con `SRI_AMBIENTE=1` el riesgo ya es bajo, pero **una
factura emitida en producción a consumidor final no se puede anular nunca**, y
staging va a emitir muchas.

## Los datos

Ni volcado de prod ni base vacía. **Config de prod copiada, clientes sintéticos.**

Se copia lo que cambia el comportamiento del sistema:

- los 3 tenants con su `businessType`, `settings` y matriz de permisos
- `services`, `service_variants`, `recipes`, `products`, `custom_fields`

Se genera, sin tocar nada real:

- `users` cliente, `client_resources`, `reservations`, `service_logs`, pagos

**Cero PII.** Ningún nombre, teléfono, correo, placa ni cédula de una persona
real cruza a staging.

Un comando `php artisan staging:seed` en `apps/backend`, con guarda dura:

```php
abort_if(app()->environment('production'), 500, 'staging:seed jamás en producción');
```

### La trampa que este spec existe para resolver

Copiar la config de los tenants **copiaría también su `ambiente` de facturación
en producción**. El ambiente es por tenant desde el 2026-08-17 (`PUT
/settings/billing-emission`), así que el `SRI_AMBIENTE=1` del `.env` del billing
**no alcanza**: el script de copia tiene que **forzar `ambiente = 1` en cada
tenant copiado**, explícitamente, después de la copia y antes de que el sistema
pueda emitir.

Esto ya nos mordió una vez en dirección contraria: el XML decía producción y la
URL salía del `.env` en pruebas. El motivo real del rechazo vivía en
`sri_response.info_adicional`, no en el mensaje visible.

## Secretos y equivalentes propios

Cada integración necesita su gemelo de staging. Ninguna se apaga.

| Pieza | Equivalente en staging |
|---|---|
| Resend | Remitente verificado en un **subdominio de staging**, destinatarios a un catch-all propio. Aísla la reputación del dominio de prod de los bounces |
| Firebase | **Proyecto propio**: service-account para el backend, `NEXT_PUBLIC_FIREBASE_*` para Vercel |
| SRI | `SRI_AMBIENTE=1` + `ambiente=1` forzado por tenant |
| Turnstile | Cloudflare publica **claves de prueba que siempre pasan** |
| Google OAuth | Agregar el redirect URI de staging, o cliente OAuth propio |
| Reverb | `REVERB_*` propios (8 variables). Autoemitidas: no hay servicio externo. **Sin ellas `artisan migrate` ni arranca** — el constructor de Pusher recibe `auth_key` nulo |
| **Cloudflare R2** | **Bucket propio.** Hallazgo del 2026-08-26, ausente del diseño original: prod tiene `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_URL`. Copiarlas haría que staging escriba archivos **dentro del bucket de producción** |
| `SESSION_DOMAIN` | **Sin definir.** Prod usa `.goturnly.com`; copiarlo scopearía las cookies de staging a todo el apex, prod incluido |

## Pruebas

Staging está listo cuando, sin intervención manual:

1. Un push a `develop` en `apps/backend/**` termina en verde y `api.staging.goturnly.com/up` responde 200 por HTTPS.
2. `staging:seed` deja los 3 tenants con datos sintéticos y **`ambiente = 1` verificable en los 3**.
3. Un login en `staging.goturnly.com` llega al panel con la matriz de permisos de prod.
4. Un registro diario cobrado emite factura y el SRI de **pruebas** devuelve AUTORIZADA.
5. Un correo transaccional llega al catch-all, con remitente del subdominio de staging.
6. El websocket conecta: una reserva creada en una pestaña aparece en otra sin recargar.
7. `terraform destroy` + `apply` reconstruye el ambiente entero desde cero, y los seis puntos anteriores vuelven a pasar. Ésta es la que convierte staging en procedimiento de recuperación.

## Riesgos

**`deploy-prod.yml` dispara con push a `main` en el path `apps/backend/**`** y
hace `artisan down` → migrate → `up`. El comando `staging:seed` vive en ese
path, así que **el día que `develop` llegue a `main`, prod entra en
mantenimiento ~26 s**. No es evitable sin sacar el comando del path, lo cual lo
sacaría del código que staging ejecuta. Se elige la hora: hay cajeros
registrando servicios en horario laboral.

Los archivos de `infra/` y `.github/workflows/deploy-staging.yml` **no** están
en los paths de `deploy-prod.yml`. Sólo el seeder.

**Costo.** $10/mes corriendo 24/7 — la factura de Vultr pasa de $22,30 a ~$32.
Vultr factura por hora, así que existe una tercera vía si el gasto fijo molesta:
crear el box antes de cada corrida de E2E y destruirlo al terminar, por
centavos. Se descarta porque pierde el caso de uso que originó todo esto —abrir
el navegador y hacer clic hasta que algo se rompa—, que es como aparecieron los
tres bugs de decimales, no en un test.

**Aparte, no urgente:** prod está sobredimensionado al 28% de RAM y 13% de
disco. Bajarlo al plan de $10 ahorraría otros $12/mes, pero implica resize con
reinicio. No se toca ahora; se anota para cuando prod se reconstruya desde este
mismo código (guarda 1).

**Deriva.** Prod está hecho a mano. Cada cambio manual en prod que no vuelva a
cloud-init hace que staging mienta un poco más. La única defensa real es el plan
de reconstruir prod desde el mismo código.

## Lo que este diseño NO hace

- No toca prod. Ni un recurso, ni un byte.
- No corrige la deuda técnica de prod (billing con `artisan serve`, `.env` a mano). La replica.
- No define los E2E. Eso es el sub-proyecto 2.
- No mete prod en Terraform. Es la guarda 1.
- No copia datos de personas reales.

## Fases

1. `infra/staging/` + cloud-init. `apply`, box arriba, DNS resolviendo.
2. `deploy-staging.yml` + secretos en GitHub. Push a `develop` que llegue solo.
3. `staging:seed` con la guarda de entorno y el forzado de `ambiente = 1`.
4. Vercel `turnly-admin` repuntado a `api.staging.goturnly.com`, dominio `staging.goturnly.com`.
5. Las 7 pruebas de arriba, incluida la de destruir y reconstruir.
6. Recién ahí, el sub-proyecto 2: Playwright en `apps/admin-v2/e2e/`, disparado por `workflow_run` al terminar el deploy de staging. Hoy **no existe nada** de E2E, ni runner de tests unitarios en el admin. Los flujos se eligen por lo que se rompió de verdad: venta sin cliente, tecleo de decimales **carácter por carácter**, edición de ticket con productos, bitácora, cierre de caja, motivos de descuento.

## Higiene previa: un DNS colgado

Al leer la zona el 2026-08-26 apareció esto, ajeno al diseño pero urgente:

```
A   api.dev.goturnly.com   ->  45.32.169.172   [DNS only]
```

Apunta al box de dev dado de baja el 2026-08-15. Vultr reasigna las IPs
liberadas a otros clientes, y quien reciba ésa controla un subdominio de
`goturnly.com`: puede servir contenido en él y hacerse emitir un certificado TLS
válido a su nombre. **Borrar el registro antes de crear nada nuevo.**

La zona entera está en *DNS only*, sin proxy de Cloudflare; el registro de
staging sigue esa misma forma. Y Resend ya está montado sobre
`send.goturnly.com` con SPF, DKIM y DMARC — el gemelo aislado de staging va en
`send.staging.goturnly.com`.

## Bloqueadores

Estado verificado el 2026-08-26:

| | |
|---|---|
| **API key de Vultr** | **Falta.** Sin key, sin CLI, sin config en el home. Es el bloqueador duro |
| **Token de Cloudflare** | **Existe.** `CF_API_TOKEN` activo, ve la zona `goturnly.com`, lectura confirmada. Permiso de escritura sin verificar — comprobarlo exige crear un registro |
| **Terraform / OpenTofu** | No instalado. `brew install opentofu` |
| SSH al box de prod | Disponible (root). Sirve para medir, no para provisionar |

El código de la fase 1 se escribe **sin ninguna credencial**; sólo el `apply`
las necesita. La alternativa a entregar la key de Vultr es que el `apply` lo
corra el usuario en local: cambia quién aprieta el botón, no el código.
