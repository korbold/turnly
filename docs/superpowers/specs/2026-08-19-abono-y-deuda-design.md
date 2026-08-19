# Abono y deuda de clientes (libro de pagos, fases 3 y 4)

> Delta sobre `docs/superpowers/specs/2026-08-18-libro-de-pagos-caja-abono-deuda-design.md`.
> Ese documento sigue vigente; éste resuelve lo que aquél dejó abierto y corrige
> una decisión suya que no sobrevive al mostrador real.

## El caso que hay que sostener

Dos escenas, contadas por el dueño:

1. **Abono.** Un servicio de $30. El cliente deja el auto y paga $10. Al retirar
   paga los $20 restantes.
2. **Deuda.** El cliente se lleva el vehículo sin terminar de pagar — un servicio,
   un producto, o los dos. Vuelve otro día y salda.

Y una tercera que no estaba en el spec original:

3. **El cuaderno.** El dueño ya lleva deudas anotadas fuera del sistema. Si la
   pantalla de Deudas arranca en cero para gente que sí debe, sigue usando el
   cuaderno y la feature no sirve para nada.

## Lo que ya está construido

Casi todo el cimiento. Vale enumerarlo porque cambia el tamaño de estas fases:

- `payments` + `payment_allocations`, **polimórfica desde el día uno**
  (`payable_type` + `payable_id`).
- `PaymentLedger`, único escritor del libro, que **ya acepta montos parciales**:
  `recordForServiceLog($log, 5.00, ...)` contra un servicio de $15 deja
  `payment_status = 'partial'` y una asignación de $5.
- `service_logs.payment_status` ensanchada a `varchar(20)`; `'partial'` ya es un
  valor que el ledger produce y que la columna acepta.
- `service_log_items.item_type` ya contempla `product`. **Un producto vendido
  viaja dentro del registro del servicio**, así que la deuda por productos no
  necesita nada nuevo: cae bajo el mismo `payable_type = 'service_log'`.
- La caja del día estampa `cash_session_id` en cada cobro, así que un pago de
  deuda entra al arqueo sin código adicional.

**El delta de datos de las dos fases es una columna booleana y una tabla.** Lo
que falta es pantalla y reglas.

## Decisiones

Las cuatro que esta conversación cerró, con lo que costaría equivocarse.

| Decisión | Por qué | Qué cuesta si me equivoco |
|---|---|---|
| La deuda es de la **placa**, y además del **cliente** cuando el recurso tiene uno | Los saldos se derivan, no se guardan: «deuda de la placa» y «deuda del cliente» son dos agrupaciones de la misma consulta sobre `service_logs`. Elegir las dos cuesta una columna en una pantalla, no un modelo | Una vista de más que nadie mira |
| Una marca explícita **«salió debiendo»** al completar | Sin ella, todo «cobrar al retirar» que nadie cerró se vuelve deudor, y la lista pierde credibilidad en un mes. El flag de cuenta corriente del spec original no sirve acá: el walk-in que se lleva el auto no tiene cliente que marcar | Un clic más al completar con saldo |
| Pago contra el cliente/placa con **reparto FIFO editable** | Cuatro deudas cobradas de a una es donde el cajero se equivoca. El reparto se muestra antes de confirmar | Un paso de confirmación en el caso de una sola deuda |
| Deudas del cuaderno como **`manual_debts`**, no como servicios retroactivos | Inventar servicios que nunca ocurrieron ensucia los reportes de producción y el consumo de inventario para siempre | Un tercer `payable_type` |

### Lo que corrige del spec anterior

El spec de agosto resolvía «quién puede deber» con un **flag de cuenta corriente
por cliente**. Esa decisión se cae: en un lavadero la mayoría es walk-in sin
cliente registrado, y es justamente el walk-in el que se lleva el auto debiendo.
Exigir identificarlo pone la fricción en el peor momento — el auto afuera y el
cliente con la mano en la puerta — y empeora un problema ya conocido, el de
walk-ins que terminan atribuidos al staff por no tener dónde poner el nombre.

Lo reemplaza la marca explícita al completar, que responde la misma pregunta
(¿esto es deuda o es un olvido?) en el momento en que alguien sabe la respuesta.

## Fase 3 — Abono

Un servicio de $30 con $10 recibidos es **un pago de $10 asignado a ese
servicio**. No hay concepto nuevo: es el libro haciendo su trabajo.

### Qué cambia

- **Al registrar**, el formulario gana un campo opcional **«Recibe ahora»**.
  Vacío se comporta como hoy (cobra el total, o nada si es «cobrar al retirar»).
  Con $10 en un servicio de $30 escribe un pago de $10 y deja el log en
  `partial`.
- **Al cobrar**, el diálogo propone el saldo pendiente en vez de asumir el total,
  y admite menos.
- **La fila** muestra `Abonado $10 · falta $20` donde hoy dice Pendiente o
  Pagado. El filtro de la lista gana la opción `partial`.
- **Completar no exige pago total.** Son ejes distintos: el auto puede estar
  lavado y el cliente deber.
- **Facturar sí exige pago total.** Una factura del SRI es por el total del
  servicio; emitirla con saldo pendiente deja un comprobante que no refleja lo
  cobrado. El botón queda deshabilitado con el motivo a la vista.
- **La bitácora** gana el monto parcial y el saldo restante en el `detail` de
  `payment_recorded`.

### Backend

Dos campos opcionales en dos requests. `PaymentLedger` no cambia.

### Bloqueante que entra en esta fase

`ReportController::range()` (:284) y `monthly()` (:384) siguen sumando
`price_charged` agrupado por método. Hoy no mienten porque todo pago es completo.
**Con el abono mienten el primer día**: un servicio de $30 con $10 cobrados suma
$30 al bucket de efectivo. La fase 2 ya movió `daily()` al libro; estos dos
quedaron señalados y ahora son bloqueantes, no diferibles. Van como primera tarea
de la fase 3.

## Fase 4 — Deuda

### Qué es una deuda

El saldo impago de un `service_log` marcado **`left_owing`**, más las
**`manual_debts`** cargadas a mano. Nada de eso se almacena como saldo: se suma
en la consulta, igual que `payment_status`.

### `service_logs.left_owing`

Boolean, default `false`. Al completar un servicio con saldo pendiente, el
diálogo pregunta: **¿cobrás ahora, o sale debiendo?**

- *Cobra ahora* → el diálogo de cobro de siempre.
- *Sale debiendo* → `left_owing = true`, evento en la bitácora, y el servicio
  entra a la lista de deudores.
- Un servicio impago **sin** la marca sigue siendo un pendiente del día, no una
  deuda. Esa es toda la diferencia entre la lista de deudores y un cajón de
  olvidos.

### `manual_debts`

```
manual_debts
  id, tenant_id
  client_resource_id  nullable   -- la placa
  client_id           nullable   -- el cliente, cuando se conoce
  amount        decimal(12,2)
  reason        string(200)      -- "3 lavados de julio, cuaderno"
  incurred_on   date             -- cuándo se generó, no cuándo se cargó
  created_by, created_at, updated_at
```

Al menos uno de `client_resource_id` / `client_id` es obligatorio: una deuda sin
deudor no es una deuda.

`incurred_on` separado de `created_at` a propósito: el dueño carga en agosto una
deuda de junio, y el día que importa es junio.

`payment_allocations.payable_type` gana el valor **`manual_debt`**. Es
exactamente para lo que la tabla nació polimórfica.

### Cobrar la deuda

Un solo pago contra la placa o el cliente. El reparto es **del más viejo al más
nuevo**, mezclando servicios y deudas manuales por su fecha, y **se muestra antes
de confirmar**:

```
Cobrar $30 a ABC-123 · debe $50

                                    debe    se abona   queda
  15 jul  Deuda del cuaderno         $15        $15      $0
  02 ago  Lavado completo            $20        $15      $5
  11 ago  Lavado + encerado          $15         $0     $15
                                              ------
                                                $30
```

El cajero puede corregir el reparto antes de confirmar. Lo que sobre de un pago
queda como saldo a favor **del cliente**; si la placa no tiene cliente, es
vuelto, no crédito — guardarlo no tendría a quién devolvérselo.

El pago pasa por `PaymentLedger`, así que entra a la caja del día y al arqueo
como cualquier otro cobro.

### Dónde se ve

- **Pantalla Deudas**: una fila por placa, con el cliente cuando el recurso lo
  tiene. Saldo ordenable, antigüedad de la deuda más vieja. Es la pantalla del
  lunes a la mañana.
- **Ficha de la deuda**: los servicios y las deudas manuales que la componen, el
  historial de pagos, y el botón para cobrar.
- **Registro Diario**: al cobrar un servicio de una placa con deuda previa, la
  pantalla lo dice — «además debe $40 de antes». Es el momento en que el cajero
  puede pedirla.

## Preparado para después, no construido ahora

Los cuatro quedan diseñados para que entren sin migrar lo ya escrito. Ninguno se
construye en estas fases.

| Feature | Dónde encaja | Qué NO hay que hacer ahora para no bloquearlo |
|---|---|---|
| **Límite de crédito** | Columna `credit_limit` en `client_resources` y/o en el cliente. El chequeo vive donde hoy se marca `left_owing` | Nada. La marca ya es el único punto por el que se puede salir debiendo, así que el límite tiene un solo lugar donde interponerse |
| **Intereses** | Tabla propia de cargos, cada uno un `manual_debt` generado por un job | No calcular saldos «al vuelo con fecha»: `incurred_on` ya deja la antigüedad disponible sin inventarla después |
| **Recordatorios** | Necesitan canal (mail o WhatsApp) y scheduler. Se apoyan en la misma consulta que la pantalla de Deudas | Extraer esa consulta a un lugar reutilizable, no dejarla incrustada en el controlador |
| **Estado de cuenta imprimible** | Un endpoint que devuelve lo mismo que la ficha de deuda, con el historial de pagos | Que la ficha de deuda ya componga servicios + manuales + pagos en una sola estructura, no tres consultas separadas en el front |

La consecuencia práctica: **la consulta de deuda vive en un servicio de
aplicación** (`DebtLedger` o similar), no en el controlador, y devuelve la
composición completa. Los cuatro futuros la reusan.

## Fuera de alcance

- Reservas. `payable_type = 'reservation'` sigue reservado y sin usar.
- Saldo a favor para placas sin cliente.
- Conciliación bancaria, multi-moneda, propinas.
- Arqueo por turno.

## Riesgo abierto que conviene decidir antes

El **efectivo huérfano de la caja**: el aviso de «$X cobrados en efectivo sin
caja» desaparece apenas se abre la sesión, aunque el backend lo siga informando.
El arqueo acusa entonces un descuadre igual a ese monto. Es un hueco del spec de
la caja, no un defecto de implementación. Conviene resolverlo antes de que haya
deudas encima, porque un descuadre con dos causas posibles no se diagnostica.

## Orden

```
1. Arreglar range() y monthly()      bloqueante del abono
2. Fase 3 — Abono                    corta, entregable sola
3. Fase 4 — Deuda                    manual_debts + reparto + pantalla
```

La 1 va dentro del plan de la fase 3. La fase 4 sale en un plan aparte.
