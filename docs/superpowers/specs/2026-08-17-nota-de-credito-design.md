# Nota de crédito electrónica (SRI, codDoc 04)

**Fecha:** 2026-08-17
**Estado:** propuesta, pendiente de aprobación
**Alcance:** anulación total de una factura autorizada. La nota de crédito parcial queda fuera.

---

## Por qué

Hoy Turnly emite facturas y nada más. `codDoc` está fijo en `'01'`
(`EmitInvoiceUseCase:44`, `FacturaXmlBuilder:63`) y las únicas tablas del servicio
de facturación son `invoices` e `invoice_items`.

Una factura autorizada por el SRI no se puede borrar: la clave de acceso queda
registrada por los 7 años de prescripción tributaria. El único instrumento para
revertirla es la nota de crédito. Sin ella, un cajero que factura con la placa
equivocada o el monto equivocado no tiene salida dentro del sistema: tiene que
ir al portal del SRI o contratar otro facturador. Es el vacío que hoy impide
presentar la facturación de Turnly como algo más que una comodidad.

## Alcance: sólo anulación total

Decidido con los datos de producción: ticket promedio **$17.90**, rango $7–$35, y
la mitad de las facturas tiene una sola línea. En una lavadora el servicio se
consume en el acto — nadie devuelve media lavada. El error real es *la factura
entera está mal*, no *quiero devolver una línea*.

Además, anular completo cubre el caso parcial (se anula y se reemite lo
correcto, al costo de un secuencial), mientras que lo inverso no aplica. Y el
riesgo fiscal se concentra justamente en lo parcial: exige recalcular IVA por
línea y llevar el acumulado de NC previas contra la factura para no exceder el
monto facturado.

## Restricción que manda sobre el diseño

**Resolución NAC-DGERCGC25-00000017 (vigente desde 2026-01-01): las facturas
emitidas a CONSUMIDOR FINAL no pueden anularse ni modificarse mediante nota de
crédito.**

En producción, de 10 facturas autorizadas, 8 llevan cédula y 2 son consumidor
final. La NC cubre la mayoría, pero no todo, y el sistema tiene que **bloquear**
el intento sobre una factura a consumidor final con un mensaje que explique por
qué — no dejar que el cajero lo descubra con un rechazo del SRI.

Consecuencia de producto, fuera del alcance de este spec pero que conviene
anotar: una factura a consumidor final es hoy irreparable para siempre. Eso
refuerza pedir identificación al cobrar.

Otras reglas confirmadas:

- **Plazo**: hasta el día 7 del mes siguiente a la emisión de la factura.
- Ítems y totales de la NC deben coincidir exactamente con la factura original.
- La NC referencia el original por clave de acceso, número `estab-ptoEmi-secuencial`
  y fecha de emisión.

## Estructura del comprobante

Fuente: `NotaCredito_V1.1.0.xsd` y ficha técnica oficiales del SRI, descargados y
verificados (no inferidos de documentación de terceros).

Raíz `<notaCredito>` con tres bloques. `infoTributaria` es **idéntico al de la
factura** salvo `codDoc=04`; `detalles/detalle` es prácticamente igual
(`descripcion`, `cantidad`, `precioUnitario`, `descuento`,
`precioTotalSinImpuesto`, `impuestos`). Lo único nuevo es `infoNotaCredito`:

| Campo | Formato XSD | Contenido |
|---|---|---|
| `fechaEmision` | dd/mm/aaaa | Fecha de emisión de la NC |
| `tipoIdentificacionComprador` | enum | Copiado de la factura |
| `razonSocialComprador` | max 300 | Copiado de la factura |
| `identificacionComprador` | max 20 | Copiado de la factura |
| `codDocModificado` | `[0-9]{2}` | `01` |
| `numDocModificado` | `[0-9]{3}-[0-9]{3}-[0-9]{9}` | estab-ptoEmi-secuencial de la factura |
| `fechaEmisionDocSustento` | dd/mm/aaaa | Fecha de la factura original |
| `totalSinImpuestos` | max 14, 2 dec | Base imponible de la factura |
| `valorModificacion` | max 14, 2 dec | Total con impuestos a reversar |
| `totalConImpuestos` | bloque | Desglose de IVA de la factura |
| `motivo` | 1–300, sin `\n` | Texto del cajero |

Opcionales y no usados por ahora: `dirEstablecimiento`, `contribuyenteEspecial`,
`obligadoContabilidad`, `rise`, `compensaciones`, `moneda`.

## Decisión estructural: el secuencial

La ficha técnica del SRI es explícita:

> *"Es responsabilidad del emisor controlar la no generación de un mismo
> secuencial para un mismo tipo de comprobante"*

El secuencial es único **por tipo de comprobante** dentro de estab+ptoEmi. Hoy
`emission_points.secuencial_actual` es un contador único, incrementado por
`EloquentInvoiceRepository::nextSecuencial()`, y sólo sirve para facturas.

**Decisión: tabla `document_sequences`**

```
document_sequences
  id                 uuid pk
  emission_point_id  uuid fk → emission_points
  cod_doc            char(2)      -- '01' factura, '04' nota de crédito
  secuencial_actual  unsigned bigint default 0
  unique (emission_point_id, cod_doc)
```

La migración copia el `secuencial_actual` vigente de cada punto de emisión como
fila `cod_doc='01'`, y `nextSecuencial()` pasa a recibir el `codDoc`.

Se descarta añadir una columna `secuencial_nc_actual` al lado de la existente:
dejar dos mecanismos conviviendo es exactamente cómo se termina duplicando un
secuencial, que es de lo poco que el SRI rechaza sin margen de corrección.

La columna vieja se deja en su sitio durante la migración y se elimina en un
paso posterior, una vez verificado en producción que las secuencias nuevas
avanzan bien.

## Qué se reutiliza

Todo lo caro ya está construido y probado en producción:

- `ClaveAcceso::generate()` — ya recibe `codDoc` como argumento
- `XadesBesSignatureService` — la firma es agnóstica al tipo
- `SriReceptionClient` / `SriAuthorizationClient` — igual
- `PollInvoiceAuthorizationUseCase` — el patrón de polling
- `TaxBreakdown` — el desglose de IVA
- La estructura de `buildInfoTributaria()` y `buildDetalle()` de `FacturaXmlBuilder`

Lo nuevo es el bloque `infoNotaCredito`, la entidad y su persistencia.

## Reparto por repositorio

### 1. `korbold/turnly-billing-service` (`~/Developer/Freelancer/Facturacion/backend`)

El grueso. Deploy propio: `develop` → dev, `master` → prod.

- Migración `document_sequences` + backfill
- Migración `credit_notes` y `credit_note_items` (espejo de `invoices`, más
  `invoice_id`, `cod_doc_modificado`, `num_doc_modificado`,
  `fecha_emision_doc_sustento`, `valor_modificacion`, `motivo`)
- `CreditNote` (entidad de dominio) y su repositorio
- `NotaCreditoXmlBuilder`
- `EmitCreditNoteUseCase`: carga la factura, valida, copia líneas, calcula
  totales, firma, envía
- `PollCreditNoteAuthorizationUseCase` (o generalizar el existente)
- RIDE de nota de crédito
- Endpoints:
  - `POST /api/invoices/{id}/credit-note` — body: `motivo`
  - `GET /api/credit-notes/{id}`, `/xml`, `/ride`
  - `GET /api/credit-notes?tenant_id=` para la lista

### 2. `Turnly/apps/backend`

- Proxy `POST /api/v1/billing/invoices/{invoiceId}/credit-note`, junto a los
  endpoints de facturación que ya existen (`InvoiceProxyController`). Se indexa
  por factura, no por service log: la NC modifica un comprobante, y un service
  log puede no ser el único origen de esa factura.
- Autorización: sólo `owner` y `tenant_admin`
- Reflejar el estado en el service log facturado, para que la fila del Registro
  Diario no siga diciendo que está facturado sin más

### 3. `Turnly/apps/admin-v2`

- Botón "Anular con NC" en una factura `autorizada`
- Modal con el motivo (max 300, sin saltos de línea)
- Estado de la NC en la lista de Facturas
- Bloqueos con explicación: consumidor final, fuera de plazo, ya anulada

## Reglas de negocio a codificar

Todas en el backend, no sólo en la UI:

1. La factura debe estar en estado `autorizada`.
2. **Bloquear si `tipo_identificacion_comprador = '07'`** (consumidor final).
3. Una sola NC de anulación por factura.
4. Advertir del plazo (día 7 del mes siguiente); decidir si se bloquea o sólo se
   advierte — ver preguntas abiertas.
5. Sólo `owner` y `tenant_admin`.

## Orden de despliegue

El billing service **primero**. Si sale antes el admin, el botón apunta a un
endpoint que no existe. Es el mismo orden que se siguió con el endpoint de
ambiente y establecimiento.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Secuencial duplicado → rechazo del SRI sin corrección posible | Tabla normalizada con unique `(emission_point_id, cod_doc)`; tests de concurrencia sobre `nextSecuencial` |
| Migración del contador mal hecha → la próxima factura repite secuencial | Backfill idempotente + verificación en dev contra datos reales antes de prod |
| NC emitida sobre consumidor final → rechazo | Bloqueo en backend, no sólo en UI |
| Totales que no cuadran con la factura | Copiar de la factura persistida, nunca recalcular desde el service log |

## Preguntas abiertas

1. **¿El plazo del día 7 se bloquea o sólo se advierte?** Las fuentes mezclan la
   *anulación de comprobante* (trámite en el portal del SRI) con la *nota de
   crédito* (documento que reversa el efecto fiscal, dentro del mismo ejercicio).
   No son lo mismo y no pude confirmar cuál plazo aplica a cuál en fuente
   oficial. Recomendación: advertir, no bloquear, hasta confirmarlo.
2. **¿La NC se prueba primero en ambiente de pruebas del SRI?** Sería lo
   sensato: el tenant de pruebas tiene certificado y el flujo ya llegó a
   AUTORIZADA una vez.
3. **¿Se elimina `emission_points.secuencial_actual` en esta entrega o después?**
   Propuesta: después, en una limpieza aparte.

## Fuentes

- `NotaCredito_V1.1.0.xsd` y `NotaCredito_V1.1.0.xml` — SRI, descargados de
  `sri.gob.ec`
- Ficha técnica de comprobantes electrónicos, esquema offline — SRI
- Resolución NAC-DGERCGC25-00000017 (2025-07-29)
