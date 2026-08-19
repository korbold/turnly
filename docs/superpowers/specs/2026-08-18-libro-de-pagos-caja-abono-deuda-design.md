# Libro de pagos: caja del día, abonos y deuda de clientes

**Fecha:** 2026-08-18
**Estado:** diseño en papel, nada construido
**Alcance:** `apps/backend`, `apps/admin-v2`

## Las tres cosas son una sola

Sobre la mesa hay tres pedidos:

1. **Caja del día** — el dueño entrega $30 de base, al final se cuenta y se cuadra.
2. **Abono** — el cliente deja $5 de un lavado de $15 y completa al retirar.
3. **Deuda de clientes especiales** — el cliente acumula servicios y después
   paga todo junto, o abona y queda debiendo.

Se ven distintas. Son la misma pregunta desde tres ángulos: **cuánta plata
entró, cuándo, de quién, y contra qué servicio.** Hoy el sistema no puede
responder ninguna de las cuatro con precisión.

## Lo que hay hoy (verificado, no recordado)

```php
// service_logs
payment_status  enum('unpaid', 'paid')   // binario
payment_method  enum('cash','card','transfer','other')
payment_bank    string nullable
paid_at         timestamp nullable
```

No existe tabla de pagos en el repositorio. El pago **vive dentro de la fila
del servicio**: un servicio tiene exactamente un pago, por el monto completo, o
ninguno. `reservations` tiene columnas equivalentes, con el mismo límite.

### Por qué eso rompe las tres

| Pedido | Lo que necesita | Lo que el modelo permite |
|---|---|---|
| Abono | 2+ pagos contra 1 servicio, montos y fechas distintos | 1 pago, 1 fecha, 1 método |
| Deuda | 1 pago contra N servicios | el pago no puede salir de la fila |
| Caja | sumar la plata que entró al cajón | sumar *precios de servicios*, que sólo coincide si todo se paga completo |

El tercero es el que muerde callado. El arqueo de caja hoy se podría calcular
como "servicios con `paid_at` en la ventana", y funcionaría — **hasta que
exista el abono**. Ese día entran $5 al cajón por un servicio de $15, el arqueo
cuenta $15, y el cierre acusa **$10 de faltante que no existe**. El cajero se
come el problema por un defecto del modelo.

Por eso la caja no se construye sobre `service_logs`. Se construye sobre el
libro de pagos, y de paso lo estrena.

## El cimiento: libro de pagos

### `payments` — cada vez que entra plata

```
id                uuid pk
tenant_id         uuid fk tenants, index
client_id         uuid nullable fk users     -- null = walk-in sin identificar
amount            decimal(12,2)              -- lo que efectivamente entró
method            string(20)                 -- cash | card | transfer | other
bank              string(40) nullable        -- sólo transferencia
paid_at           timestamp
received_by       uuid fk users              -- quién cobró
cash_session_id   uuid nullable fk cash_sessions
notes             text nullable
timestamps
```

**`cash_session_id` se estampa, no se infiere.** Un pago en efectivo se ata a
la sesión de caja abierta en ese momento. Calcularlo después por ventana de
tiempo falla en los bordes reales: la caja que se abrió tarde, la que se cerró
antes de que el último cliente pagara, el pago de las 23:58. Pinchar el
vínculo cuando ocurre el hecho es más barato y no miente.

Los pagos que no son efectivo llevan `cash_session_id = null`: no entran al
cajón, aunque sí a la recaudación del día.

### `payment_allocations` — contra qué se aplica

```
id            uuid pk
tenant_id     uuid fk tenants, index
payment_id    uuid fk payments, cascadeOnDelete
payable_type  string(30)      -- service_log | reservation
payable_id    uuid
amount        decimal(12,2)   -- cuánto de ese pago cancela ese servicio
timestamps
```

Polimórfica desde el día uno. `reservations` ya tiene su propio flujo de
prepago con las mismas columnas heredadas; hacerla polimórfica ahora cuesta dos
campos y evita una segunda migración con backfill cuando las reservas entren.

**Invariante:** la suma de las asignaciones de un pago nunca supera su monto.
Lo que sobra es **saldo a favor del cliente** — el caso de "abonó de más" o
"pagó por adelantado sin servicio todavía".

### Lo derivado no se guarda dos veces

- **Estado de un servicio** = comparar lo asignado contra `price_charged`:
  nada → `unpaid`, algo → `partial`, todo → `paid`.
- **Deuda de un cliente** = suma de sus servicios impagos − sus pagos sin
  asignar.

Ninguno de los dos se guarda como columna de verdad. Los saldos almacenados se
desincronizan el día que alguien escribe por un camino que nadie recordaba, y
la única forma de saber cuál miente es recalcular — así que se recalcula
siempre.

`service_logs.payment_status` **sobrevive como columna derivada**: se recalcula
en cada pago y gana el valor `partial`. Es back-compat con los filtros de la
lista, los reportes y los tiles, que ya la leen. `payment_method` y `paid_at`
quedan como "último pago", denormalizados para la fila de la lista.

## Feature 1 — Caja del día

### Tablas

```
cash_sessions
  id, tenant_id
  opened_by, opened_at, opening_amount        -- la base que entrega el dueño
  closed_by, closed_at
  counted_amount    decimal nullable          -- lo que el cajero contó
  expected_amount   decimal nullable          -- lo que el sistema esperaba
  difference        decimal nullable          -- counted - expected
  status            enum(open, closed)
  notes             text nullable

cash_movements
  id, tenant_id, cash_session_id
  type      enum(expense, withdrawal, deposit)
  amount    decimal(12,2)
  reason    string(200)
  created_by, created_at
```

Tres tipos en una tabla, no tres tablas. **Egreso** es plata gastada (almuerzo,
insumos). **Retiro** es el dueño llevándose la recaudación: sale del cajón pero
no es un gasto, y mezclarlos ensucia cualquier reporte de gastos futuro con
cifras que no son gastos. **Ingreso** es el espejo: reposición de cambio.

### La cuenta

```
esperado = apertura
         + pagos en efectivo de la sesión      (payments.method = cash)
         + ingresos
         − egresos
         − retiros

diferencia = contado − esperado
```

Sólo efectivo. Tarjeta y transferencia no están en el cajón.

### Reglas

- **Una sesión por día del negocio.** No por cajero: si dos personas cobran el
  mismo día, comparten cajón y la diferencia es del turno.
- **No bloquea.** Se puede cobrar sin caja abierta; si hay efectivo cobrado sin
  sesión, la pantalla avisa. Trabar el mostrador por un olvido de la mañana es
  peor que el descuadre.
- **Cierre ciego.** El cajero cuenta y declara; recién entonces el sistema
  revela esperado y diferencia. Si la pantalla muestra el esperado antes, el
  cajero escribe ese número y el control es teatro.
- **La caja de ayer no se cierra sola.** Nadie contó esa plata a medianoche. Al
  abrir hoy, el sistema exige cerrar la anterior y dice de qué día es.
- **Cerrada no se reabre.** Si el conteo estuvo mal, *ese* es el hecho. Se
  corrige con un movimiento en la caja siguiente, no reescribiendo el pasado.

### Permisos

Privilegio nuevo **Caja** en la matriz: default `full` para Admin y Cajero,
`none` para Lavador. Mismo patrón que Precio, Eliminar y Asignados.

### UI

Tarjeta arriba del Registro Diario:

```
CAJA DEL DÍA · abierta 08:12 por Caja Prueba
Base $30,00 · 3 movimientos                    [ Movimiento ]  [ Cerrar caja ]
```

Cerrada, muestra la diferencia con su signo y color. Sin abrir y con efectivo
cobrado, un aviso sin botón de pánico.

## Feature 2 — Abono

Un servicio de $15 con $5 recibidos es **un pago de $5 asignado a ese
servicio**. No hay concepto nuevo: es el libro haciendo su trabajo.

- El diálogo de cobro deja de asumir el total: propone el saldo pendiente y
  admite menos.
- La fila muestra `Abonado $5 · falta $10` en vez de Pendiente/Pagado.
- `payment_status` pasa a `partial`. Los filtros de la lista ganan esa opción.
- **Completar el servicio no exige pago total.** Son ejes distintos: el auto
  puede estar lavado y el cliente deber. Lo que sí conviene es que la fila lo
  grite.
- **Facturar exige pago total.** Una factura del SRI es por el total del
  servicio; emitirla con saldo pendiente deja un comprobante que no refleja lo
  cobrado. El botón queda deshabilitado con el motivo a la vista.

## Feature 3 — Deuda de clientes

### Quién puede deber

Un flag por cliente: **cuenta corriente habilitada**. Sin eso, cualquier
walk-in podría acumular deuda por un olvido de cobro, y la lista de deudores
se llena de gente que pagó y nadie marcó.

### El flujo

1. Los servicios del cliente se registran como "cobrar al retirar" y quedan
   impagos.
2. Cuando el cliente paga, se registra **un pago contra el cliente**, no contra
   un servicio.
3. El pago se reparte: por defecto **del más viejo al más nuevo**, con
   corrección manual antes de confirmar.
4. Lo que sobra queda como saldo a favor y se aplica solo al siguiente
   servicio.

### Dónde se ve

- Ficha del cliente: **saldo pendiente**, servicios que lo componen, historial
  de pagos.
- Lista de clientes: columna de deuda, ordenable. Es la pantalla que el dueño
  va a mirar los lunes.
- Registro Diario: un servicio de un cliente con deuda muestra el saldo previo
  al cobrar, para que el cajero pueda decir "además debe $40 de antes".

### Lo que NO incluye

Límite de crédito, intereses, recordatorios automáticos, estado de cuenta
imprimible. Todo eso es una segunda conversación después de ver la feature
funcionando un mes.

## Qué cambia de lo que ya existe

Esta es la parte cara, y conviene mirarla de frente.

1. **`recordPayment` deja de escribir en el servicio.** Crea un pago, lo asigna,
   y recalcula el estado. Las columnas del servicio pasan a derivadas.
2. **Los tiles del día cambian de fuente.** Hoy "EFECTIVO $15" suma
   `price_charged` de los servicios en efectivo. Con abonos eso miente: hay que
   sumar **montos de pagos**. Es el mismo bug de la caja, un nivel más arriba.
3. **Backfill.** Cada servicio con `payment_status = paid` se convierte en un
   pago por su `price_charged`, con su método, su `paid_at` y su
   `attended_by` como `received_by`. Sin `cash_session_id`: no había sesiones.
4. **Reportes.** Lo que hoy agrupa por método sobre servicios pasa a agrupar
   sobre pagos. Los números del pasado no cambian — el backfill los reproduce
   exactamente — pero la consulta sí.
5. **La bitácora del servicio** ya registra `payment_recorded`. Gana el monto
   parcial y el saldo restante en el `detail`.

## Orden de construcción

```
1. Libro de pagos + backfill        el cimiento; nada visible todavía
2. Caja del día                     primer consumidor: prueba que el libro sirve
3. Abono                            un pago parcial es el libro haciendo lo suyo
4. Deuda de clientes                pagos contra el cliente + saldo
```

La caja va segunda a propósito. Es la feature que **obliga a que el libro esté
bien**: si el arqueo cuadra todos los días durante una semana, el cimiento es
sólido. Si se construye primero el abono, el error se descubre más tarde y con
plata real de por medio.

Cada paso deja el sistema funcionando. Después del 1 nada cambia para el
usuario; después del 2 hay caja; después del 3, abonos; después del 4, deuda.

## Decisiones que tomé al diseñar

Están acá para que las discutas, no para que las aceptes.

| Decisión | Por qué | Qué cuesta si me equivoco |
|---|---|---|
| Libro de pagos antes que las tres features | Sin él, la caja nace con un bug que aparece recién cuando llega el abono | Una fase que no muestra nada al usuario |
| `payment_allocations` polimórfica | `reservations` tiene el mismo problema y va a entrar | Dos columnas que quizá nunca se usen |
| Saldos derivados, no almacenados | Un saldo guardado se desincroniza y nadie sabe cuál miente | Consultas un poco más caras |
| `cash_session_id` estampado en el pago | Inferir por ventana falla en los bordes reales | Una FK más |
| Una caja por día, no por cajero | Es lo que pediste; simple de cuadrar | Un faltante no tiene dueño individual |
| Cierre ciego | Mostrar el esperado antes convierte el control en trámite | Un paso más para el cajero |
| Facturar exige pago total | Una factura con saldo pendiente no refleja lo cobrado | Hay que cobrar todo antes de facturar |
| Cuenta corriente por flag de cliente | Sin flag, cualquier olvido de cobro se convierte en deuda | Un campo más al crear cliente |

## Lo que este diseño NO resuelve

- **Arqueo por turno.** Una caja por día no responde "¿de quién fue el
  faltante?" si trabajaron dos.
- **Reservas.** Las allocations las contemplan, pero el flujo de prepago de
  reservas no se toca en estas cuatro fases.
- **Multi-moneda, propinas, vueltos.** No aparecieron en ningún pedido.
- **Conciliación bancaria.** Lo que dice "transferencia" se cree; nadie lo
  compara contra el banco.
