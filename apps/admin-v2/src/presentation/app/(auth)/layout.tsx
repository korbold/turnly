'use client';

import { CalendarCheck2, ShieldCheck, Sparkles } from 'lucide-react';

const HIGHLIGHTS = [
  {
    Icon: CalendarCheck2,
    title: 'Agenda en un toque',
    body: 'Reagenda y registra walk-ins sin abrir tres pantallas.',
  },
  {
    Icon: Sparkles,
    title: 'Hecho para tu mostrador',
    body: 'Mobile primero. Pensado para usar entre cliente y cliente.',
  },
  {
    Icon: ShieldCheck,
    title: 'Datos seguros',
    body: 'Tu agenda y clientes, respaldados y solo para ti.',
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--bg-app)] lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* Brand pane (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-[var(--brand-50)] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-[var(--brand-500)] opacity-[0.08] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -right-32 h-[480px] w-[480px] rounded-full bg-[var(--brand-700)] opacity-[0.06] blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-2.5">
          <img
            src="/turnly-wordmark.svg"
            alt="Turnly"
            width={120}
            height={40}
            className="h-9 w-auto"
          />
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-700)]">
              El mostrador digital
            </p>
            <h2 className="mt-2 text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink-900)] xl:text-[40px]">
              Atiende, agenda y cobra desde un mismo lugar.
            </h2>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--ink-600)]">
              Reemplaza la libreta y los grupos de WhatsApp con una herramienta hecha para tu negocio.
            </p>
          </div>

          <ul className="space-y-3.5">
            {HIGHLIGHTS.map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--brand-700)] shadow-[0_1px_2px_0_rgba(15,18,26,0.05)]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--ink-700)]">{title}</p>
                  <p className="text-[12.5px] leading-snug text-[var(--ink-500)]">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[11.5px] text-[var(--ink-500)]">
          Turnly © {new Date().getFullYear()} · Hecho en Ibarra.
        </p>
      </aside>

      {/* Form pane */}
      <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8 lg:py-12">
        <div className="w-full max-w-[380px]">
          {/* Mobile-only logo */}
          <div className="mb-6 flex justify-center lg:hidden">
            <img
              src="/turnly-wordmark.svg"
              alt="Turnly"
              width={120}
              height={40}
              className="h-9 w-auto"
            />
          </div>

          {children}

          <p className="mt-8 text-center text-[11.5px] text-[var(--fg-muted)] lg:hidden">
            Tu mostrador, en cualquier dispositivo.
          </p>
        </div>
      </main>
    </div>
  );
}
