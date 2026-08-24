# La persona detrás del vehículo

**Fecha:** 2026-08-24
**Estado:** diseño, sin implementar
**Origen:** «hay dueños que tienen más de un carro y quiero unir; Gaby debe $30 en uno y $89 en el otro, y el cajero quiere buscar por nombre, ver los dos autos, la suma total, y cobrar o abonar la deuda»

## El problema

Turnly modela vehículos, no personas. Cada `client_resource` es un auto con
sus campos, su historial y su deuda. Cuando la misma persona tiene dos autos,
el sistema no tiene dónde sumarlos: son dos filas sin nada que las una.

Eso alcanza para una lavadora el 90% del tiempo —la placa **es** la identidad
del cliente— y falla justo donde duele: la deuda. Gaby debe $119 repartidos en
dos autos, y hoy no hay pantalla que lo diga ni forma de cobrarlo de una vez.

### Lo que la medición encontró

Antes de diseñar nada se midió el tenant real (FEDER, 2026-08-24, después de
fusionar los duplicados):

| | |
|---|---|
| vehículos | 274 |
| con nombre de cliente cargado | **23** |
| colgados de un usuario del **personal** | **237** |
| **visibles al navegar Clientes** | **37** |

Los últimos dos números son el mismo problema. `ClientResourceController::index`
esconde a propósito los recursos que cuelgan del personal —para no mostrar los
autos de los propios empleados— y el mostrador cuelga **todo** de quien está
logueado. Resultado: la pantalla de Clientes muestra 37 de 274 vehículos. El
resto sólo aparece si se busca la placa exacta.

La causa es una asimetría de una línea en `ClientResourceController::store()`:

```php
if ($isAdmin) {
    $clientId = $clientName ? $this->findOrCreateClient($clientName, $tenantId)->id : null;
} else {
    $clientId = $user->id;   // ← el cajero queda como dueño del auto
}
```

Cuando registra un admin, la persona se crea sola. Cuando registra un cajero,
el auto queda colgado de la cajera. **La identidad ya existe a medias: le falta
el camino del cajero, que es por donde entra el 100% del trabajo real.**

## La decisión

**Una persona es una fila de `users` con rol `client` dentro del tenant.** No
se crea una tabla nueva:

- ya existe `findOrCreateClient($nombre, $tenantId)`;
- ya existe `ClientSearchController::search`, que busca por nombre, correo,
  teléfono y cédula, y devuelve `created_by_walkin` y el rol;
- ya existe `client-resources/{id}/transfer`, para mover un auto de una persona
  a otra;
- un cliente creado en el mostrador puede después reclamar su cuenta de la app
  (el flujo de *claim* ya existe), y eso sólo funciona si es un `user`.

Lo que falta no es el modelo. Es **usarlo desde el mostrador** y **sumar deuda
por persona**.

## Cómo se captura la identidad

Decisión del dueño (2026-08-24): **el nombre sigue siendo opcional**, pero el
campo deja de ser texto libre y pasa a ser un buscador que reutiliza.

```
Nombre del cliente
[gaby____________]

  Gaby Arellano · 2 vehículos · debe $119
  Gabriela Ruíz · 1 vehículo
  + Crear "gaby"
```

- Teclear muestra las personas que ya existen en el tenant.
- Tocar una liga el auto a esa persona.
- «Crear» la da de alta y liga.
- No tocar nada deja el auto sin dueño, como hoy.

El razonamiento: obligar a cargar el nombre suma fricción en la pantalla que
se usa con el auto adelante y la cola esperando, y el 90% de los lavados no
necesita persona. Pero el cliente repetido —que es el que acumula deuda— queda
ligado con un toque.

**El auto nunca más queda colgado del cajero.** Sin nombre, `client_id` queda
en `null`, que es lo que ya hace el camino del admin.

## La deuda por persona

Lo difícil ya está construido. `PaymentLedger::recordAgainstResource()` arma
**un solo pago con varias asignaciones**, repartiendo de la deuda más vieja a
la más nueva, y `DebtLedger::planFor()` calcula ese reparto. Todo recibe un
`client_resource_id`.

Sube un nivel:

- `DebtLedger::outstandingForClient($tenantId, $clientId)` — las deudas de
  todos sus vehículos, ordenadas por antigüedad.
- `DebtLedger::planForClient($tenantId, $clientId, $monto)` — el reparto.
- `PaymentLedger::recordAgainstClient(...)` — un pago, asignaciones repartidas
  entre los autos.

El cajero cobra $50 a Gaby y el sistema los reparte: $30 al auto viejo, $20 al
otro. **El reparto se muestra antes de confirmar**, porque es la clase de
automatismo que hay que poder auditar de un vistazo.

## Las pantallas

**Buscar por nombre.** La lista de Clientes hoy es una lista de vehículos. Pasa
a mostrar **personas** cuando el término coincide con una, con sus vehículos
adentro y su deuda sumada. Buscar una placa sigue devolviendo el vehículo.

**La ficha de la persona.** Sus vehículos, su deuda total, su historial junto,
y el botón de cobrar/abonar que reparte.

**El vehículo** conserva su ficha y suma una línea: «Gaby Arellano · debe $119
en 2 vehículos», que es el aviso que el cajero necesita cuando llega uno de
los dos autos.

## Lo que se hace con los datos viejos

**No se adivina.** Agrupar por el nombre escrito juntaría a dos «Gaby» y
separaría a «Gaby A.» de «Gaby Arellano» — con deuda, eso es peor que no tener
la función.

1. **Los 237 colgados del personal**: se les quita ese dueño (`client_id` a
   `null`). No es una pérdida: hoy ese campo dice algo falso. El efecto
   inmediato es que **aparecen en Clientes**, que es donde deberían haber
   estado siempre.
2. **Los 23 con nombre**: se propone la persona y el dueño confirma. Son
   pocos y se revisan de a uno.
3. **El resto**: quedan como vehículo sin persona. Está bien — en una lavadora
   la placa alcanza.

## Lo que este diseño NO hace

- **No fusiona personas.** Si mañana hay dos «Gaby Arellano», hace falta un
  «unir personas» que hoy no existe. Se deja para cuando duela.
- **No pide teléfono.** Es la llave que de verdad distingue homónimos, y el
  dueño decidió no sumar ese campo ahora. El diseño no lo bloquea.
- **No toca la facturación.** El perfil fiscal ya vive en el usuario
  (`user_billing_profiles`) y se beneficia solo cuando el auto tiene persona.
- **No convierte la deuda en una cuenta corriente.** Sigue siendo la suma de
  deudas por servicio; sólo se lee y se cobra agrupada.

## Riesgos

**El cajero liga el auto a la persona equivocada.** Dos nombres parecidos en
la lista y un toque apurado. Mitigación: la lista muestra los vehículos de cada
persona («Gaby Arellano · IBE3469, PCC7286»), que es lo que el cajero reconoce.
Y `transfer` ya permite corregirlo.

**Cobrar de más a quien no debía.** El reparto automático toca varios autos con
un solo pago. Mitigación: se muestra el reparto antes de confirmar y queda en
la bitácora de cada servicio, como ya pasa hoy con el pago por vehículo.

**La limpieza de los 237 se hace de una vez.** Es un `UPDATE` masivo sobre
producción. Mitigación: comando con simulacro, backup, y el invariante a
verificar es que ni la plata ni la cantidad de servicios cambien — el mismo
método que se usó con los duplicados.

## Fases

1. **Cortar el origen.** El mostrador liga o deja sin dueño; nunca al cajero.
   Buscador de personas en el alta. *(Sin esto, todo lo demás se llena de basura
   nueva mientras se limpia la vieja.)*
2. **Soltar los 237.** Comando con simulacro. Efecto inmediato y visible: la
   pantalla de Clientes deja de mostrar 37 de 274.
3. **Deuda por persona.** Ledger, ficha de la persona, cobro repartido. Es lo
   que pidió el dueño y lo que resuelve el caso de Gaby.
4. **Los 23 con nombre.** Propuesta de agrupación para confirmar a mano.

Las fases 1 y 2 se pueden desplegar juntas y ya mejoran la pantalla sin tocar
plata. La 3 toca cobros y va sola, con su vuelta por el navegador.
