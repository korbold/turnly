# Caja compartida entre dos personas

Fecha: 2026-08-24
Estado: aprobado — en implementación
Reemplaza: la propuesta de turnos de caja (archivada, ver el final)

## El problema, con los datos que lo mostraron

El 24 de agosto la caja de FEDER cerró con **−$50.00**. Investigarlo destapó
algo más grande que la diferencia.

### Quién toca el dinero y quién responde por él

| | Pagos en efectivo del día | Monto |
|---|---|---|
| **Fernanda** (recién entra, está aprendiendo) | 23 | **$434** |
| **Vanessa** (abre y cierra la caja) | 3 | $75 |

No hay turnos: las dos trabajan juntas, en el mismo horario, sobre el mismo
cajón. Fernanda maneja el 85% del efectivo; Vanessa firma el arqueo. Cuando
falta plata, el sistema se la adjudica a quien tocó $75, y el dueño no tiene
con qué separar una cosa de la otra.

### El cierre llegó antes que el final del día

A las 18:35, cuando Vanessa cerró, quedaban **8 servicios con $305 sin
cobrar**. Veintiún minutos después Fernanda cobró $45 de uno de ellos, con
la caja ya cerrada: ese pago quedó con `cash_session_id` en NULL. No lo
espera la caja de hoy, que cerró, ni la de mañana, que abre con base nueva.

### Los $50: tres lecturas, y la base de datos no las separa

La diferencia es exactamente la base ($40) más un aumento de media mañana
($10), y lo declarado es exactamente el efectivo cobrado ($464.00).

1. Vanessa declaró lo cobrado en vez de contar el cajón.
2. Faltan $50 de verdad.
3. **Los $50 nunca estuvieron físicamente en el cajón** — la base y el
   aumento se tecleaon como número sin que el billete entrara.

La tercera encaja mejor con lo que sabemos: Vanessa es cajera, y con la caja
abierta **no ve los totales del día** (es el conteo ciego). Cobró 3 veces.
Para declarar $464.00 exactos tendría que haber sumado a mano las 26 filas
del día. Si el cajón nunca tuvo más que lo cobrado, contó bien.

**Esto no se decide con SQL.** La pregunta es para ellas: *cuando abriste la
caja, ¿los $40 estaban en el cajón? ¿y los $10 de Fernanda?*

## Lo que se construye

### 1. Avisar al cerrar si quedan cobros pendientes

El diálogo de cierre avisa antes de contar: *"Hay 8 servicios sin cobrar por
$305. Si alguien todavía va a pagar hoy, cerrá después."* No bloquea.

Mostrar lo pendiente no rompe el conteo ciego: es plata que **no** está en el
cajón, así que no revela el esperado. Y el cajero no ve el total del día,
que sigue oculto, así que tampoco se puede despejar por resta.

Ataca la causa exacta del huérfano de hoy.

### 2. Reabrir la caja

Cerrar por error mientras el local sigue trabajando no puede ser
irreversible.

- Sólo dueño o admin. Si el cajero pudiera reabrir su propio arqueo, el
  conteo ciego se volvería reversible y el control sería teatro.
- Exige motivo escrito.
- **El cierre anterior no se borra.** El arqueo de las 18:35, con su −$50, es
  un hecho ocurrido: se guarda en `cash_session_closures` (contado,
  esperado, diferencia, quién, cuándo) y la sesión vuelve a abierta. Cada
  cierre siguiente agrega otra fila. Sin esto, reabrir sería una goma de
  borrar sobre el único número que alguien compara contra billetes.

### 3. Desglosar el arqueo por persona

El sistema ya sabe quién cobró cada pago (`received_by`); hoy no lo muestra
en ninguna parte. Al cerrar —cuando ya no hay nada que ocultar— el resumen
lista cuánto efectivo cobró cada quien.

Con dos personas en un cajón, es la única forma de que una diferencia
signifique algo. No asigna culpa: da la conversación.

## Lo que NO entra

- **Turnos de caja.** La propuesta anterior partía de leer el cobro de las
  18:56 como un cambio de turno. Es falso: trabajan juntas, en el mismo
  horario. Construir turnos sería resolver un problema que no tienen.
- Bloquear el cobro con la caja cerrada. Empuja a cobrar por fuera del
  sistema, que es peor que un huérfano recuperable.
- Cambiar la fórmula del esperado: ya es la estándar de la industria.
- Tocar el conteo ciego.

## Riesgo

Es plata. Tests antes del código en las tres piezas, y con cuidado especial
en la reapertura, que es la única que reescribe un arqueo ya firmado.
