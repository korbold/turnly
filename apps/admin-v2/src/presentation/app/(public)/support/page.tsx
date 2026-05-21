import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Soporte · Turnly',
  description: 'Centro de ayuda y soporte para la app móvil Turnly y el panel de administración.',
  openGraph: {
    title: 'Soporte · Turnly',
    description: 'Centro de ayuda y soporte para la app móvil Turnly y el panel de administración.',
    url: 'https://goturnly.com/support',
  },
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
              T
            </div>
            <span className="font-semibold text-zinc-900">Turnly</span>
          </Link>
          <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article className="prose prose-zinc max-w-none prose-headings:text-zinc-900 prose-p:text-zinc-700 prose-a:text-[var(--color-primary)] prose-strong:text-zinc-900">
          <h1>Soporte · Turnly</h1>
          <p>Aquí atendemos dudas sobre la app móvil de clientes y el panel de administración Turnly.</p>

          <h2>Contacto</h2>
          <ul>
            <li>
              <strong>Email:</strong>{' '}
              <a href="mailto:soporte@turnly.app">soporte@turnly.app</a>
            </li>
            <li>
              <strong>Horario:</strong> Lun–Vie, 9:00–18:00 (ECT). Respondemos en menos de 24 h hábiles.
            </li>
            <li>
              <strong>Ubicación:</strong> Ibarra, Ecuador.
            </li>
          </ul>

          <h2>Preguntas frecuentes</h2>

          <h3>¿Cómo creo una reserva desde la app?</h3>
          <p>
            Abre la app y toca el negocio que deseas. Elige el servicio, el profesional y el horario
            disponible. Confirma y recibirás una notificación de confirmación.
          </p>

          <h3>¿Cómo cancelo o reprogramo una reserva?</h3>
          <p>
            Ve a &ldquo;Mis reservas&rdquo; en la app, toca la reserva activa y selecciona
            &ldquo;Cancelar&rdquo; o &ldquo;Reprogramar&rdquo;. Puedes hacerlo hasta 1 hora antes de la
            cita.
          </p>

          <h3>No me llegan las notificaciones push, ¿qué hago?</h3>
          <p>
            Verifica que los permisos de notificaciones estén activados para Turnly en Configuración de
            tu teléfono. Si el problema persiste, escríbenos a{' '}
            <a href="mailto:soporte@turnly.app">soporte@turnly.app</a>.
          </p>

          <h3>¿Cómo cambio mi negocio favorito o busco otro?</h3>
          <p>
            Usa el buscador en la pantalla principal de la app para explorar negocios disponibles. Toca
            el ícono de corazón para marcarlo como favorito.
          </p>

          <h3>¿La app es gratis?</h3>
          <p>
            Sí. La app para clientes es completamente gratuita. Los negocios pagan una suscripción
            mensual para usar el panel de administración; eso no afecta a los clientes.
          </p>

          <h2>Eliminar mi cuenta</h2>
          <p>Puedes eliminar tu cuenta directamente desde la app:</p>
          <ol>
            <li>
              Ve a <strong>Perfil</strong> en la barra inferior.
            </li>
            <li>
              Toca <strong>Configuración</strong>.
            </li>
            <li>
              Selecciona <strong>Eliminar cuenta</strong> y confirma.
            </li>
          </ol>
          <p>
            Si no puedes acceder a la app, escríbenos a{' '}
            <a href="mailto:soporte@turnly.app">soporte@turnly.app</a> desde el correo registrado con el
            asunto <strong>&ldquo;Eliminar cuenta&rdquo;</strong>. Procesamos la solicitud en 7 días
            hábiles.
          </p>

          <h3>¿Qué datos se eliminan?</h3>
          <p>
            Se eliminan tu perfil, historial de reservas visibles en la app y preferencias. Por
            obligaciones legales y fiscales, conservamos datos de transacciones contables durante 7 años
            conforme a la legislación ecuatoriana, tal como se detalla en nuestra{' '}
            <Link href="/privacy">Política de Privacidad</Link>.
          </p>

          <h2>Privacidad y términos</h2>
          <p>
            Consulta nuestra <Link href="/privacy">Política de Privacidad</Link> y nuestros{' '}
            <Link href="/terms">Términos y Condiciones</Link>.
          </p>

          <p className="mt-12 text-xs text-zinc-400">Versión 1.0 · Actualizado el 2026-05-21</p>
        </article>
      </main>
    </div>
  );
}
