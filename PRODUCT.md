# Product

## Register

product

## Users

Dueños y personal de pequeños negocios de servicio en Ibarra (Ecuador): barberías, salones, spas, consultorios. Perfil dominante: dueño-recepcionista híbrido que atiende y administra simultáneamente, sin oficina fija, operando desde el mostrador o el celular en mano. Salones más grandes suman recepcionistas dedicadas en tablet o desktop. El smartphone es el dispositivo primario; desktop es secundario.

Contexto de uso: jornadas con interrupciones constantes (clientes presentes, llamadas, walk-ins), atención dividida, consultas rápidas entre tareas. Necesitan respuesta inmediata, no flujos largos.

Trabajo principal (job-to-be-done): ver y mover las reservas del día sin fricción. Todo lo demás (catálogo de servicios, gestión de clientes, reportes) sirve a esa columna vertebral.

## Product Purpose

Turnly es una plataforma multi-tenant de gestión de citas y servicios. Admin-v2 es el shell que el negocio usa para operar el día: agenda visible de un vistazo, reagendar y registrar walk-ins en pocos toques, mantener catálogo de servicios y clientes al día, consultar ingresos cuando hace falta.

Éxito = el negocio confía en la app como su único punto de control diario, reemplazando agendas en papel, hojas de cálculo o WhatsApp como sistema de reservas.

## Brand Personality

Clara, confiable, ágil. Voz cercana-profesional: tutea al usuario, sin jerga corporativa, sin gringuismos forzados. Habla como un colega competente, no como un ejecutivo. Confianza tranquila, no sobrevenderse. Ritmo rápido pero nunca agresivo.

Emociones objetivo: calma operativa (todo bajo control), velocidad percibida (la app responde), respeto al tiempo del usuario (sin pasos que sobren).

## Anti-references

- **Calendly / Acuity SaaS aséptico**: blanco-azul genérico, frío, evidente que es plantilla gringa. No encaja culturalmente con un negocio de barrio en Ibarra.
- **POS antiguo estilo Windows**: gris denso, tablas planas, tipografía sin jerarquía. Se siente obsoleto antes de abrirse.
- **Material Design plano por defecto**: parece prototipo de Google sin terminar; ripples, FABs y sombras genéricas.
- **Dashboard tipo Stripe/Linear oscuro-tech**: estética para ingenieros silicon valley, fuera de tono para una barbería o spa local.

## Design Principles

1. **El día primero, todo lo demás después.** Cada pantalla del shell debe ayudar al dueño a ver o mover la agenda del día. Si una vista no sirve a eso, va más profundo en la jerarquía.
2. **Mobile en serio, no afterthought.** El celular es el dispositivo primario, no un caso responsive. Cada interacción se diseña a 375px primero; desktop expande, no define.
3. **Velocidad percibida sobre completitud.** Optimista en UI, latencia oculta, feedback inmediato. Mejor mostrar algo en 100ms y reconciliar que esperar a tener todo.
4. **Densidad respetuosa.** Información suficiente sin saturar. Tap targets 44px, espaciado generoso en zonas críticas, denso solo en tablas que el usuario inspecciona con calma.
5. **Coral con disciplina.** El brand `#F2693A` es para acción y estado, no decoración. Neutros zinc-cool cargan la mayor parte de la superficie; el coral guía la mirada al siguiente paso.

## Accessibility & Inclusion

- WCAG **AA** como objetivo. AAA no aplica: costo/beneficio malo para el segmento.
- Contraste mínimo 4.5:1 para texto; coral usable como acento pero `--brand-600` para texto sobre blanco.
- Tap targets ≥ 44×44px en toda interacción mobile (lo exige también el público mayor del segmento).
- `prefers-reduced-motion` respetado en todas las animaciones de framer-motion: deshabilitar transiciones no esenciales.
- Estados de foco visibles siempre (no `outline: none` sin reemplazo).
- Sin dependencia de color para comunicar estado (los chips de reserva ya combinan color + etiqueta de texto, mantener ese patrón).
- Considerar usuarios mayores (40+ es común entre dueños de negocio en Ibarra): tipografía base no menor a 14px, evitar grises demasiado claros para texto secundario.
