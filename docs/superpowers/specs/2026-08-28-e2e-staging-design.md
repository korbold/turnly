# Tests que abren el navegador

**Fecha:** 2026-08-28
**Estado:** spec listo para implementar
**Alcance:** sub-proyecto 2 de `2026-08-26-staging-e2e-design.md`. El ambiente ya existe; esto es lo que corre encima.

## El problema

Los tres bugs de `fix/decimales-y-venta-producto` aparecieron **al abrir el
navegador**, con el plan aprobado y 700 tests de Pest en verde: venta de
mostrador que exigía un vehículo que no existía, `4.25` que entraba a la base
como `2425`, y un diálogo de edición que reenviaba productos como servicios y
rompía la foránea con un 500 silencioso.

Pest no los vio porque SQLite no aplica claves foráneas y porque nadie tecleó
en un `<input>`. El sub-proyecto 1 construyó el lugar donde ejercitar la UI.
Falta lo que la ejercita: hoy **no existe nada** de E2E en el repo, ni siquiera
un runner de tests unitarios en el admin.

## Estado del ambiente, medido hoy

| | |
|---|---|
| Box | `45.32.174.149`, `api.staging.goturnly.com/up` → 200 |
| Admin | `staging.goturnly.com` → proyecto Vercel `turnly-admin`, construye desde `develop` |
| Deploy | Automático desde `develop`; el commit de hoy (`4b68ee3`) llegó solo |
| Datos | `turnly_staging` sembrada: 3 tenants, 45 registros, 44 usuarios |
| Colas | `turnly-queue` y `turnly-reverb` activos |
| Facturación | **No.** `/var/www/billing` tiene sólo `.env.skeleton`, el servicio está inactivo |
| Correo | **No.** `MAIL_MAILER=log` |

Los dos "no" son deuda del sub-proyecto 1 y acotan esta tanda: ningún flujo que
dependa de factura o de correo entra acá.

## Las tres decisiones

**Base nueva en cada corrida.** El workflow hace `migrate:fresh` + `staging:seed`
antes de los tests. El seed es idempotente pero no borra: sin el `fresh`, cada
corrida dejaría sedimento —tickets a medio cobrar, cajas abiertas de la corrida
anterior, precios editados— y el punto de partida sería distinto cada vez. Con
el `fresh`, el catálogo, los precios, los roles y las cajas arrancan siempre
iguales. El precio es que una corrida borra lo que estés mirando a mano en
staging; es predecible y se acepta.

**Andamiaje más dos flujos.** Escribir los seis flujos contra una tubería que
todavía no demostró ser estable en CI es escribir dos veces. Entran venta de
mostrador sin cliente y decimales tecleados carácter por carácter — los dos
bugs que más dolieron. Los otros cuatro se suman después, ya baratos.

**Señal, y freno a prod.** Un rojo no bloquea nada en `develop`. Pero
`deploy-prod.yml` consulta el semáforo: sin corrida verde de E2E para ese
commit, no despliega. `workflow_dispatch` queda como salida de emergencia.

## Orquestación

Workflow nuevo `.github/workflows/e2e-staging.yml`, con **dos disparos**:

```yaml
on:
  workflow_run:
    workflows: ['Deploy Staging (backend)']
    types: [completed]
  push:
    branches: [develop]
    paths: ['apps/admin-v2/**']
  workflow_dispatch:
```

Los dos hacen falta. `Deploy Staging` sólo corre con cambios en
`apps/backend/**`; un cambio puro de admin —de donde salieron los tres bugs— no
lo dispara, y con `workflow_run` como único trigger nunca se probaría.

Pasos:

1. **Esperar al admin.** El backend puede estar listo mientras Vercel todavía
   construye, y los tests pegarían contra el bundle viejo. Ruta nueva
   `apps/admin-v2/src/app/api/version/route.ts` que devuelve
   `VERCEL_GIT_COMMIT_SHA` — Vercel lo inyecta solo en el build. El workflow
   hace polling hasta que el SHA coincida, con timeout de 5 minutos. Sin token
   de Vercel y sin secreto nuevo; de paso queda una forma de saber qué está
   desplegado.
2. **Chequear la API.** `api.staging.goturnly.com/up` → 200.
3. **Resetear.** SSH con los `STAGING_DEPLOY_*` que ya existen:
   `php artisan migrate:fresh --force && php artisan staging:seed`. Mismo canal
   que el deploy, ninguna superficie nueva expuesta en la app. Si esto falla, el
   job muere acá: correr tests contra una base a medio sembrar produce rojos que
   no significan nada.
4. **Correr Playwright** contra `https://staging.goturnly.com`.
5. **Subir el diagnóstico** (trace, screenshot, video) como artifact al fallar.

El semáforo en `deploy-prod.yml` es un primer paso que le pregunta a la API de
GitHub por la conclusión del workflow E2E para `github.sha`, con el
`GITHUB_TOKEN` que el runner ya trae. Hoy `develop` entra a `main` por
fast-forward, así que el SHA es el mismo y siempre la encuentra. El día que
`main` reciba un merge commit no habrá corrida para ese SHA y el paso va a
fallar con el motivo — se destraba con `workflow_dispatch`.

## Estructura y sesión

```
apps/admin-v2/
  playwright.config.ts
  e2e/
    .auth/                        ← storageState por rol (gitignored)
    setup/auth.setup.ts
    flows/venta-mostrador.spec.ts
    flows/decimales.spec.ts
```

El login del panel es `identifier` + `password`, y el slug del tenant llega en
la respuesta y vive en `localStorage`. Un `storageState` de Playwright captura
las dos cosas de una: un proyecto `setup` entra por la UI una vez por rol y
guarda el estado; los specs lo reusan y arrancan ya adentro.

Dos roles, ambos de `autospa-demo` (car_wash, el rubro de los tres bugs):

| rol | identificador | contraseña |
|---|---|---|
| Cajero | `cajero@autospa-demo.staging.goturnly.com` | `staging1234` |
| Admin | `admin@autospa-demo.staging.goturnly.com` | `staging1234` |

La contraseña la imprime el seed y va en el workflow como variable normal: en
un sandbox no es un secreto, y tratarla como tal sólo agrega ceremonia.

`baseURL` sale de `E2E_BASE_URL`, con default a staging. `workers: 1` — la base
es compartida y dos tests escribiendo el mismo día se pisan el arqueo.
`retries: 1` en CI y `0` en local. `trace: 'on-first-retry'`, screenshot y video
sólo al fallar. Timeouts holgados (test 60s, expect 10s): staging es 1 vCPU y
responde más lento que una laptop. Chromium de escritorio nada más; el viewport
móvil queda anotado para la siguiente tanda.

`@playwright/test` entra como devDependency de `admin-v2`; en CI se instala sólo
el binario de Chromium. Scripts: `e2e`, `e2e:ui`, `e2e:headed`.

Los locators van por rol y por etiqueta (`getByRole`, `getByLabel`). Donde la UI
no dé un nombre accesible estable, se **agrega un `data-testid` al componente**
antes que colgar el test de una clase de Tailwind. Eso toca código de la app:
poco, pero lo toca.

## Los dos flujos

El seed reparte sus registros sobre 18 días, así que **hoy ya tiene filas**
antes de que el test toque nada. Ningún test afirma el total del día: afirma
sobre *su* ticket, localizado por un dato que sólo él tiene, y sobre el delta
del contador. Así el seed puede crecer sin ponerlos en rojo.

### Venta de mostrador sin cliente

Como Cajero, en Registro Diario:

1. Abrir el modal, agregar **sólo un producto**, guardar **sin elegir vehículo**.
2. El ticket entra: aparece en la lista del día con el total del producto, y su
   detalle dice "Sin recurso" y "Sin cliente" sin ofrecer error.
3. En un modal nuevo, agregar una línea de **servicio** sin vehículo y afirmar
   que **no** se puede guardar.

Las dos mitades importan. La primera es el bug que se arregló el 20 de agosto;
la segunda es la regla que ese arreglo no podía romper —un servicio se presta
sobre algo— y hoy ningún test de navegador la cuida.

### Decimales tecleados carácter por carácter

Como Cajero:

1. Registrar un servicio y editar el precio de la línea escribiendo `4`, `.`,
   `2`, `5` con **`pressSequentially`, nunca con `fill`**. No es estilo: `fill`
   asigna el valor de golpe y el bug de `MoneyInput` sólo aparece tecla por
   tecla. Un test escrito con `fill` habría pasado en verde sobre el bug.
2. El input muestra `4.25` mientras se escribe.
3. Los centavos sobreviven el viaje entero: `$4,25` en la fila del Registro
   Diario **y** en el detalle del ticket.

El paso 3 es el que vale. El bug no era que el input se viera raro: era que
`4.25` llegaba a la base como `2425` y nadie se enteraba hasta el arqueo.

## Cómo se sabe que sirve

Un andamiaje de tests que nunca se puso rojo no demostró nada. Antes de dar la
tanda por cerrada se rompe a propósito una afirmación de cada flujo y se
confirma que el job falla y que el trace muestra el motivo. Recién ahí queda en
verde.

Contra el titileo: nada de `waitForTimeout`, sólo la espera automática de los
locators y los `expect`. El `retries: 1` está para absorber la red, no para
tapar una carrera — un test que necesite el reintento de forma sistemática se
arregla o se saca, porque un test que titila enseña a ignorar el rojo.

## Pruebas

Esta tanda está lista cuando, sin intervención manual:

1. Un push a `develop` en `apps/backend/**` deja el workflow de E2E en verde.
2. Un push a `develop` en `apps/admin-v2/**` también lo dispara y lo deja en verde.
3. Los dos flujos pasan contra una base recién sembrada.
4. Romper una afirmación pone el job en rojo y el artifact trae el trace que lo explica.
5. Con el E2E en rojo, `deploy-prod.yml` se niega a desplegar ese commit.
6. Con el E2E en verde, `deploy-prod.yml` despliega como siempre.

## Lo que este diseño NO hace

- No prueba facturación ni correo. Staging no los tiene todavía.
- No prueba el websocket, ni el viewport móvil, ni los otros cuatro flujos del spec anterior.
- No agrega tests unitarios al admin. Es otro sub-proyecto.
- No convierte `main` en rama protegida ni obliga a pasar por pull request. El freno a prod es un paso del workflow, no una regla de GitHub.
- No toca prod, salvo el paso que consulta el semáforo antes de desplegar.

## Fases

1. `@playwright/test`, `playwright.config.ts`, `e2e/setup/auth.setup.ts` y la ruta `/api/version`. Verde local contra staging con un test de humo.
2. `e2e-staging.yml` con sus dos disparos, la espera del SHA y el reset por SSH.
3. Flujo de venta de mostrador sin cliente.
4. Flujo de decimales carácter por carácter.
5. El paso del semáforo en `deploy-prod.yml`.
6. Romper a propósito, confirmar el rojo y el trace, volver a verde.

## Riesgos

**Una corrida borra staging.** Si alguien está mirando datos a mano cuando entra
un push a `develop`, los pierde. Mitigación: es predecible y el log lo dice.

**Dependencia de dos deploys ajenos.** Si Vercel tarda más de 5 minutos, el job
falla esperando el SHA. Es un rojo honesto —el ambiente no estaba listo— y se
repite con `workflow_dispatch`.

**El seed cambia y los tests se caen.** Por eso ninguna afirmación depende de
totales globales ni de cantidades que el seed elija. Si un test se rompe al
crecer el seed, es el test el que está mal escrito.

**Los `data-testid` se multiplican.** El riesgo real de un E2E es que la app se
llene de ganchos para el test. Regla: `data-testid` sólo donde el rol y la
etiqueta no alcanzan, y se justifica en el diff.
