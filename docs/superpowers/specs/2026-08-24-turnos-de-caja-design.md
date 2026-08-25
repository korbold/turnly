# Turnos de caja

Fecha: 2026-08-24
Estado: propuesta — sin implementar, esperando decisiones

## El problema, con los datos que lo mostraron

El 24 de agosto, la caja de FEDER cerró con **−$50.00**. La investigación
encontró dos cosas distintas, y sólo una era la que se veía.

La diferencia no era un faltante: era exactamente la base ($40) más un
aumento de media mañana ($10). La cajera declaró $464.00 — al centavo, el
efectivo que había *cobrado* — mientras el cajón además tenía la plata con
la que arrancó el día. Eso ya está corregido nombrando la base en el
diálogo de cierre.

Lo otro apareció mirando las horas:

| Hora | Qué pasó | Quién |
|---|---|---|
| 08:15 | Abre caja con base $40 | Vanessa |
| 10:43 | Aumento de caja +$10 | **Fernanda** |
| 18:35 | Cierra caja: declara $464, esperado $514 | Vanessa |
| 18:56 | Cobra $45 en efectivo | **Fernanda** |

Eso no es "un cobro tardío". Es un **cambio de turno**: Vanessa cierra el
suyo y Fernanda sigue atendiendo. El local ya trabaja por turnos; el
sistema no los tiene.

Como Turnly modela **una caja por día del negocio**, el cobro de Fernanda
no tenía dónde caer: quedó con `cash_session_id` en NULL. Ese billete está
en el cajón y ninguna caja lo reclama — ni la de hoy, que ya cerró, ni la
de mañana, que abre con base nueva. Hoy son $45. Es plata que el sistema
no sabe que existe, todos los días que haya dos turnos.

## Qué hace el resto de la industria

Contrastado con documentación de Alegra POS, Clip, Dux y Pulpos:

- **La fórmula del esperado de Turnly ya es la estándar**: base + ventas en
  efectivo + ingresos − retiros − devoluciones. No hay error de cálculo.
- **El cajero cuenta todo el cajón, incluida la base**; el fondo fijo se
  resta después. (Esto confirmó el diagnóstico del −$50.)
- **Los POS exigen turno abierto para cobrar.** No bloquean por rigor:
  bloquean porque abrir un turno es un clic.
- **El turno saliente entrega el efectivo y el entrante lo recibe como
  base.** El día se compone de turnos; no hay "la caja del día" como
  unidad indivisible.

Turnly hace bien lo primero y lo segundo. Le falta lo tercero y lo cuarto.

## Lo que cambia

### Modelo

Hoy `cash_sessions` tiene `unique(tenant_id, business_date)`: ese índice
**es** la regla de una-caja-por-día, y es el candado a abrir.

- Se reemplaza por `unique(tenant_id, business_date, sequence)`, donde
  `sequence` es 1, 2, 3… — el turno dentro del día.
- La regla que sí hay que mantener es **una sola sesión abierta a la vez
  por tenant**. Hoy la garantizaba el índice; con turnos hay que garantizarla
  aparte. MySQL no tiene índices parciales, así que se hace con una columna
  `open_marker` que vale `tenant_id` mientras la sesión está abierta y NULL
  cuando se cierra, con un único sobre ella: dos NULL no colisionan, dos
  abiertas sí. La protección contra dos pestañas sigue viviendo en la base
  y no sólo en el servicio.
- `handed_over` (lo que el turno saliente declara entregar) queda implícito:
  es su `counted_amount`. No hace falta columna nueva.

### Servicio (`CashRegister`)

- `openSession` deja de rechazar por "ya hubo una caja hoy". Sigue
  rechazando si hay **cualquiera abierta**, incluida la de un día anterior:
  esa regla es buena y se queda.
- `sequence` se calcula solo: el siguiente del día.
- **Adopción de huérfanos**: al abrir un turno, los pagos en efectivo sin
  sesión hechos **desde el cierre anterior** pasan a esta sesión. Ese
  dinero está en el cajón y el primer arqueo que pueda contarlo debe
  contarlo. El corte en el último cierre es lo que evita que un turno se
  trague meses de historia previa a que existiera la caja.
- `expectedFor` no cambia. Al asignar `cash_session_id`, los adoptados
  entran solos.

### Pantalla

- La barra de caja pasa de "Caja del día" a "Turno 2 · abierto por
  Fernanda · base $X". El día muestra sus turnos.
- Al cerrar, el resumen dice a cuánto queda la entrega.
- Al abrir un turno que no es el primero del día, la base viene sugerida
  con lo que entregó el anterior (editable — ver decisiones).
- Si al abrir se adoptaron cobros huérfanos, el diálogo lo dice: *"Se
  suman $45 cobrados con la caja cerrada"*. Es información de apertura, no
  del cierre: no rompe el conteo ciego.

## Decisiones que necesito de vos

1. **La base del turno entrante.** ¿Se prellena con lo que declaró el
   saliente (rápido, pero el entrante firma un número que no contó), o
   entra vacía para que cuente (más lento, es el control de verdad)?
   Mi recomendación: **prellenada pero marcada**, y si el entrante escribe
   otra cifra se guarda la discrepancia de entrega. Rápido en el caso
   normal, deja rastro cuando importa.

2. **Cobrar sin turno abierto.** ¿Se bloquea (con botón "Abrir turno" en el
   mismo diálogo) o se permite y se adopta después? Mi recomendación:
   **permitir y adoptar**, al menos en la primera versión: bloquear con el
   cliente enfrente empuja a cobrar por fuera del sistema, que es peor que
   un huérfano que después se recoge.

3. **Quién abre y cierra turno.** ¿Cualquier cajero, o hace falta el
   privilegio? Hoy abrir/cerrar caja ya pasa por la matriz de permisos;
   habría que decidir si el turno hereda esa misma regla.

4. **El arqueo del día.** ¿El dueño quiere ver un número por día (suma de
   turnos) o el detalle turno por turno? Cambia el reporte, no el modelo.

## Alcance y riesgo

Superficie chica: 4 endpoints, un servicio, un índice. Lo que hay que
revisar con cuidado es que `sessionFor(tenant, fecha)` hoy devuelve *una*
sesión y pasaría a devolver varias — lo usa el endpoint que pinta la barra
de caja.

Riesgo real: **es plata**. Todo cambio acá necesita tests antes del código,
incluida la migración del índice único, que en producción falla si hay dos
filas que colisionen (no las hay: FEDER tiene una sola sesión cerrada en
toda su historia, la del 24).

## Lo que NO entra

- Varias cajas físicas simultáneas (dos mostradores atendiendo a la vez).
  Esto es turnos en el tiempo, no cajas en paralelo.
- Cambiar la fórmula del esperado. Ya es la correcta.
- Tocar el cierre ciego. Se queda como está.
