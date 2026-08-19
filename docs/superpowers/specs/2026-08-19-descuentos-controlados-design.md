# Descuentos con motivo y reporte

## El problema, como lo contó el dueño

«Las cajeras pueden modificar el precio cuando registran: el servicio es $15 y
lo cambian a $12 en algunos, porque hay clientes especiales que tienen precios
diferentes. Eso es hurto de dinero.»

El fraude concreto: el cajero cobra $15 al cliente, registra $12, y se queda
con $3. En el sistema no queda nada raro — un lavado de $12 se ve exactamente
igual que un lavado de $12 legítimo.

Y la mitad legítima del problema es igual de real: **sí hay clientes con precio
distinto**. Cualquier control que impida bajar el precio traba el mostrador.

## Lo que ya existe (verificado, no recordado)

| Camino | Hoy | Auditoría |
|---|---|---|
| `POST /service-logs` | **Bloqueado** sin privilegio `Precio`: 403 `PRICE_LOCKED` | — |
| `PATCH /service-logs/{id}` | **Bloqueado** igual | — |
| `PUT /service-logs/{id}/items` | **Bloqueado** igual | — |
| `PATCH /reservation-items/{id}/price` | **Abierto a cualquier miembro** | Sí: precio viejo, nuevo, motivo, usuario |

`Cajero.Precio` está en `none` por default y así está en los seis tenants
locales. Por Registro Diario, hoy, el hurto descrito **no puede ocurrir**.

Por Reservaciones sí: `assertCanOverridePrice()` valida el *estado* de la
reserva (no pagada, en check-in) y **no** el privilegio de quien la toca.

## Las dos cosas que están mal

**1. Dos políticas contradictorias para la misma pregunta.** Registro Diario
prohíbe; Reservaciones permite. La misma cajera, el mismo dinero, dos reglas.

**2. Prohibir empuja a desactivar el control.** Un precio especial legítimo
obliga a llamar al dueño. Después de la tercera vez el dueño concede `Precio`
al Cajero «para que la caja no se trabe», y ahí se pierde todo: pasa de
prohibido a invisible, que es peor que permitido y visible.

Y la auditoría que ya existe en Reservaciones **no la lee nadie**: no hay
ninguna pantalla que muestre descuentos. Anotar sin reportar es no anotar.

## La decisión

**Un descuento se puede hacer, pero tiene que verse distinto de una venta
normal.** Precio de catálogo, precio cobrado, diferencia, quién y por qué —
y un reporte que el dueño lee junto con el arqueo.

El privilegio `Precio` deja de significar «puede tocar el precio» y pasa a
significar **«puede hacerlo sin justificar»**. El dueño no escribe motivos.

### Motivos: lista fija, no texto libre

```
cliente_frecuente   Cliente frecuente
promocion           Promoción
cortesia            Reclamo o cortesía
acordado            Precio acordado con el dueño
otro                Otro  → exige nota escrita
```

Texto libre se degrada a «descuento», «x», «asd» en un mes, y deja el reporte
sin agrupar. Peor: permite escribir literalmente «cliente especial», que es la
excusa que este diseño existe para volver auditable.

Lista **fija y no configurable** por ahora: cinco motivos cubren barbería,
lavadora, spa y consultorio igual, y una pantalla de configuración es una
decisión más al arrancar para un negocio que tiene tres motivos reales.
Volverla configurable después es leer una tabla en vez de una constante — sin
migrar nada, porque los valores ya son categorías.

**`otro` con nota obligatoria es la señal de si la lista sirve**: si el 70% de
los descuentos caen ahí, la lista está mal y el reporte lo dice solo.

## Datos

Dos columnas y una tercera prestada. Ninguna tabla nueva.

```
service_log_items
  + catalog_price   decimal(12,2) nullable

service_logs
  + price_change_reason  string(40)  nullable   -- el código de la lista
  + price_change_note    string(200) nullable   -- sólo cuando el código es 'otro'

reservation_item_changes
  + reason_code          string(40)  nullable   -- el código; `reason` queda como la nota
```

**`catalog_price` es una foto del momento del registro, no una consulta.** Sin
eso el reporte miente: si mañana el lavado sube de $15 a $18, todos los cobros
de $15 de hoy aparecerían como descuentos de $3. Nullable porque las filas
históricas no la tienen, y una fila sin catálogo no es un descuento: es una
fila vieja.

**El motivo va en el ticket, no en la línea.** En el mostrador nadie escribe
tres motivos para tres servicios del mismo cliente.

**El autor y la hora no necesitan columna.** Ya los tiene la bitácora del
servicio, que gana un evento `price_changed` con catálogo, cobrado y motivo.

## Reglas

- **Cualquier desvío del catálogo pide motivo**, hacia abajo o hacia arriba.
  Una sola regla, sin casos especiales. Cobrar de más no es el fraude que
  preocupa, pero un recargo sin explicar tampoco debería existir.
- Sin el privilegio `Precio`, el motivo es **obligatorio** y el backend
  rechaza el registro sin él (422 `REASON_REQUIRED`). Con el privilegio, es
  opcional.
- El umbral es un centavo (`0.005`), el mismo que ya usa `firstTamperedPrice`:
  el precio va y vuelve por JSON y no sobrevive una comparación exacta.
- **Reservaciones se cierra en el sentido correcto**: sigue permitido para
  todos, pero `reason_code` pasa a ser obligatorio y validado contra la lista.
  Hoy acepta cualquier texto.
- Un descuento **no bloquea la facturación**. El SRI factura lo cobrado; el
  precio de catálogo es un dato interno.

## El reporte

`Reportes → Descuentos`, con el mismo rango de fechas que el resto.

```
DESCUENTOS · agosto                        Dejado de cobrar: $312,00

Cliente frecuente   $180,00   12 servicios
Promoción            $92,00    8
Reclamo o cortesía   $40,00    3

19 ago 14:32  Cajero AutoSpa  PBT2759  Lavado Premium   $30 → $25   −$5   Cliente frecuente
19 ago 11:05  Cajero AutoSpa  JKL889   Lavado Completo  $15 → $12   −$3   Otro · "amigo del dueño"
```

- Une los dos orígenes: registros y reservas. Al dueño no le importa por qué
  pantalla entró la plata que no entró.
- **El total arriba es el control**; el detalle es la evidencia. Un dueño que
  ve «$312 dejados de cobrar este mes» hace una pregunta que nunca se le
  hubiera ocurrido.
- Agrupado por motivo, y por cajero cuando hay más de uno: la comparación
  entre personas es lo que delata.
- Vive detrás del privilegio de **Reportes**, que el Cajero no tiene por
  default. Un reporte de descuentos visible para quien los hace no controla
  nada.
- **Los descuentos del dueño también aparecen**, con el motivo en blanco
  («Sin motivo»). Él no está obligado a justificar, pero la plata que dejó de
  entrar es la misma y el total tiene que cuadrar con la realidad. Un reporte
  que sólo cuenta los descuentos ajenos no sirve para decidir precios.

## Lo que este diseño NO hace

- **Tarifas por cliente.** Sería el control más fuerte —el dueño define el
  precio de ese cliente una vez y nadie lo toca— pero es una feature nueva y
  el usuario la descartó por tamaño. Este diseño no la bloquea: el día que
  exista, el precio pactado deja de ser un descuento y desaparece del reporte
  solo.
- **Límite de descuento** por rol o por monto. Un tope invita a quedarse justo
  debajo. El reporte con nombre y monto acumulado es un control más honesto.
- **Aprobación en dos pasos.** Trabaría el mostrador, que es el error que este
  diseño existe para no repetir.
- **Motivos configurables.** Ver arriba.

Si el reporte muestra que un cajero regala $200 al mes, eso se resuelve
hablando con él, no con más software.

## Riesgo asumido

El cajero puede elegir un motivo cualquiera de la lista y seguir robando: pone
«cliente frecuente» en un descuento inventado. Este diseño **no lo impide** y
no pretende hacerlo.

Lo que hace es dejar el hecho con nombre, monto, hora y una razón declarada.
Un robo sostenido deja un patrón —el mismo cajero, el mismo motivo, todos los
meses— y el patrón es visible en la primera pantalla del reporte. Es el mismo
criterio del cierre ciego: no se busca volverlo imposible, se busca volverlo
caro y visible.
