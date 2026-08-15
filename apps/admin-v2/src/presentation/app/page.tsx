import Link from 'next/link';
import { SessionNav } from '@/presentation/components/features/public/session-nav';
import {
  Bell,
  BarChart3,
  Globe,
  Users,
  Smartphone,
  Check,
  ArrowRight,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react';

interface PublicPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  max_services: number | null;
  max_reservations_per_month: number | null;
  max_employees: number | null;
  has_push_notifications: boolean;
  has_reports: boolean;
  has_reminders: boolean;
  has_custom_page: boolean;
}

async function fetchPlans(): Promise<PublicPlan[]> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  try {
    const res = await fetch(`${base}/public/plans`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { data: PublicPlan[] };
    return json.data;
  } catch {
    return [];
  }
}

function formatLimit(value: number | null): string {
  if (value === null) return 'Ilimitado';
  return String(value);
}

function pluralServices(value: number | null): string {
  if (value === null) return 'Servicios ilimitados';
  if (value === 1) return '1 servicio';
  return `${value} servicios`;
}

function pluralReservations(value: number | null): string {
  if (value === null) return 'Reservas ilimitadas';
  if (value === 1) return '1 reserva al mes';
  return `${value} reservas al mes`;
}

function pluralEmployees(value: number | null): string {
  if (value === null) return 'Equipo ilimitado';
  if (value === 0) return 'Solo dueño';
  if (value === 1) return '1 empleado + dueño';
  return `${value} empleados + dueño`;
}

export default async function LandingPage() {
  const plans = await fetchPlans();

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-soft)] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand-500)] text-[12px] font-bold text-white">
              T
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--ink-900)]">
              Turnly
            </span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            <a href="#features" className="text-[13px] text-[var(--ink-600)] transition-colors duration-150 hover:text-[var(--ink-900)]">
              Características
            </a>
            <a href="#pricing" className="text-[13px] text-[var(--ink-600)] transition-colors duration-150 hover:text-[var(--ink-900)]">
              Planes
            </a>
          </nav>
          <div className="flex items-center gap-2.5">
            <SessionNav />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[var(--brand-500)] opacity-[0.07] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgba(15,18,26,0.05)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
        />

        <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-200)] bg-white/70 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--brand-700)]">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Hecho para Ecuador
          </span>
          <h1 className="mt-5 text-[40px] font-extrabold leading-[1.05] tracking-[-0.025em] text-[var(--ink-900)] sm:text-[64px]">
            Tu negocio, tus reservas,{' '}
            <span className="text-[var(--brand-500)]">en piloto automático.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-[var(--ink-600)]">
            Agenda online, recordatorios automáticos, reportes y página pública.
            Empieza gratis. Sin tarjeta.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--brand-500)] px-5 text-[14px] font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--brand-600)] active:scale-[0.97]"
            >
              Crear mi negocio
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex h-11 items-center rounded-lg border border-[var(--border-firm)] bg-white px-5 text-[14px] font-medium text-[var(--ink-700)] transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--niebla-clara)] active:scale-[0.97]"
            >
              Ver planes
            </a>
          </div>
          <p className="mt-5 text-[12px] text-[var(--ink-500)]">
            Barberías · Spas · Clínicas · Gimnasios · Pet grooming · Car wash
          </p>

          {/* Product mock preview */}
          <div className="relative mx-auto mt-14 max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white shadow-[0_24px_48px_-12px_rgba(15,18,26,0.18)]">
              {/* Mock window chrome */}
              <div className="flex items-center gap-1.5 border-b border-[var(--border-soft)] bg-[var(--niebla-clara)] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                <span className="ml-3 text-[11px] text-[var(--ink-500)]">turnly.app/barberia-elite</span>
              </div>
              {/* Mock dashboard preview */}
              <div className="grid grid-cols-[180px_1fr] bg-white">
                <div className="border-r border-[var(--border-soft)] p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-[var(--brand-500)]" />
                    <div className="h-2.5 w-14 rounded bg-[var(--ink-150)]" />
                  </div>
                  {['Hoy', 'Reservas', 'Clientes', 'Servicios', 'Reportes'].map((item, i) => (
                    <div
                      key={item}
                      className={`mb-1 rounded-md px-2 py-1.5 text-[11px] ${
                        i === 0
                          ? 'bg-[var(--brand-50)] font-semibold text-[var(--brand-700)]'
                          : 'text-[var(--ink-500)]'
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <div className="bg-[var(--niebla-clara)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--brand-700)]">
                        Hoy
                      </div>
                      <div className="mt-0.5 text-[15px] font-bold text-[var(--ink-900)]">
                        Sábado, 9 de mayo
                      </div>
                    </div>
                    <div className="rounded-md bg-[var(--brand-500)] px-2.5 py-1.5 text-[10px] font-medium text-white">
                      + Nueva reserva
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { time: '10:00', name: 'Luis Pérez', svc: 'Corte clásico', state: 'confirmed' },
                      { time: '11:30', name: 'Ana Torres', svc: 'Tinte + corte', state: 'pending' },
                      { time: '14:00', name: 'Walk-in', svc: 'Barba', state: 'progress' },
                    ].map((r) => (
                      <div
                        key={r.time}
                        className="flex items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-white px-3 py-2"
                      >
                        <div className="font-mono text-[12px] tabular-nums text-[var(--ink-700)]">
                          {r.time}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-[12px] font-medium text-[var(--ink-900)]">
                            {r.name}
                          </div>
                          <div className="truncate text-[10.5px] text-[var(--ink-500)]">
                            {r.svc}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            r.state === 'confirmed'
                              ? 'bg-[#E4F1FE] text-[#1666BF]'
                              : r.state === 'pending'
                                ? 'bg-[#FFF6E0] text-[#B47114]'
                                : 'bg-[#DCE8FF] text-[#1A56D6]'
                          }`}
                        >
                          {r.state === 'confirmed' ? 'Confirmado' : r.state === 'pending' ? 'Pendiente' : 'En curso'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Floating accent badge */}
            <div className="absolute -bottom-4 left-6 hidden rounded-xl border border-[var(--border-soft)] bg-white px-4 py-2.5 shadow-[0_14px_32px_-8px_rgba(15,18,26,0.12)] sm:flex sm:items-center sm:gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8F8F0] text-[#0B7A44]">
                <Check className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[var(--ink-900)]">+128 reservas hoy</div>
                <div className="text-[10px] text-[var(--ink-500)]">Sin llamadas, sin WhatsApp</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — bento varied */}
      <section id="features" className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-700)]">
              Todo en un mostrador
            </p>
            <h2 className="mt-2 text-[32px] font-extrabold tracking-[-0.02em] text-[var(--ink-900)] sm:text-[40px]">
              Hecho para correr tu día.
            </h2>
            <p className="mt-3 text-[15px] text-[var(--ink-600)]">
              Sin instalación. Sin contratos. Cancela cuando quieras.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Hero feature: Agenda */}
            <div className="md:col-span-2 row-span-2 flex flex-col justify-between rounded-2xl border border-[var(--border-soft)] bg-gradient-to-br from-[var(--brand-50)] via-white to-white p-7 md:row-span-1">
              <div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[var(--brand-700)] shadow-[0_1px_2px_0_rgba(15,18,26,0.05)]">
                  <Calendar className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[20px] font-bold tracking-tight text-[var(--ink-900)]">
                  La agenda del día, primero.
                </h3>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--ink-600)]">
                  Reservas en una columna, walk-ins en un toque. La pantalla que abres entre cliente y cliente.
                </p>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-[var(--border-soft)] bg-white/70 p-2 backdrop-blur-sm">
                {['09:00', '10:00', '11:00'].map((t, i) => (
                  <div key={t} className="flex flex-col gap-1 rounded-lg bg-white p-2">
                    <div className="font-mono text-[10px] tabular-nums text-[var(--ink-500)]">{t}</div>
                    <div
                      className={`h-1.5 rounded-full ${i === 0 ? 'bg-[var(--brand-500)]' : i === 1 ? 'bg-[#E89320]' : 'bg-[var(--ink-150)]'}`}
                    />
                    <div className="text-[10px] text-[var(--ink-700)] truncate">
                      {i === 0 ? 'Corte' : i === 1 ? 'Tinte' : 'Libre'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recordatorios */}
            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFF6E0] text-[#B47114]">
                <Bell className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-[var(--ink-900)]">
                Recordatorios automáticos
              </h3>
              <p className="mt-1.5 text-[13px] leading-snug text-[var(--ink-600)]">
                Push y email un día antes y 2 horas antes. Reduce no-shows hasta 70%.
              </p>
            </div>

            {/* Reportes */}
            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8F8F0] text-[#0B7A44]">
                <BarChart3 className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-[var(--ink-900)]">
                Reportes en tiempo real
              </h3>
              <p className="mt-1.5 text-[13px] leading-snug text-[var(--ink-600)]">
                Ingresos diarios, semanales, mensuales. Cash, tarjeta o transferencia.
              </p>
            </div>

            {/* Página pública */}
            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#E4F1FE] text-[#1666BF]">
                <Globe className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-[var(--ink-900)]">
                Tu página pública
              </h3>
              <p className="mt-1.5 text-[13px] leading-snug text-[var(--ink-600)]">
                Link <span className="font-mono text-[12px]">turnly.app/tu-negocio</span>. Comparte en redes.
              </p>
            </div>

            {/* Equipo */}
            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-700)]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-[var(--ink-900)]">Equipo y roles</h3>
              <p className="mt-1.5 text-[13px] leading-snug text-[var(--ink-600)]">
                Cajeros, staff, admin. Cada uno ve sólo lo que necesita.
              </p>
            </div>

            {/* App móvil */}
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--ink-900)] p-6 text-white md:col-span-2">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur-sm">
                    <Smartphone className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-[18px] font-semibold tracking-tight">
                    Tus clientes con la app en el bolsillo.
                  </h3>
                  <p className="mt-1.5 max-w-md text-[13px] leading-snug text-white/70">
                    Descargan la app, ven historial y agendan en segundos. iOS + Android.
                  </p>
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  <div className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-medium backdrop-blur-sm">
                    iOS
                  </div>
                  <div className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-medium backdrop-blur-sm">
                    Android
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-[var(--bg-app)] py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-700)]">
              Planes
            </p>
            <h2 className="mt-2 text-[32px] font-extrabold tracking-[-0.02em] text-[var(--ink-900)] sm:text-[40px]">
              Empieza gratis. Crece a tu ritmo.
            </h2>
            <p className="mt-3 text-[15px] text-[var(--ink-600)]">
              Sin sorpresas. Sin contratos. Cancela cuando quieras.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const popular = plan.slug === 'pro';
              const free = plan.price === 0;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border bg-white p-6 transition-shadow duration-150 ${
                    popular
                      ? 'border-[var(--brand-500)] shadow-[0_14px_32px_-8px_rgba(242,105,58,0.25),0_4px_8px_-4px_rgba(15,18,26,0.06)]'
                      : 'border-[var(--border-soft)] hover:shadow-[0_4px_12px_-2px_rgba(15,18,26,0.08)]'
                  }`}
                >
                  {popular && (
                    <span className="absolute -top-2.5 left-6 inline-flex items-center gap-1 rounded-full bg-[var(--brand-500)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Más elegido
                    </span>
                  )}
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--ink-900)]">{plan.name}</h3>
                    <p className="mt-1 min-h-[36px] text-[12px] leading-snug text-[var(--ink-500)]">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="font-mono text-[28px] font-extrabold tabular-nums tracking-tight text-[var(--ink-900)]">
                      {free ? 'Gratis' : `$${plan.price.toFixed(2)}`}
                    </span>
                    {!free && (
                      <span className="text-[12px] text-[var(--ink-500)]">/mes</span>
                    )}
                  </div>

                  <Link
                    href="/register"
                    className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg text-[13px] font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
                      popular
                        ? 'bg-[var(--brand-500)] text-white hover:bg-[var(--brand-600)]'
                        : 'border border-[var(--border-firm)] bg-white text-[var(--ink-700)] hover:bg-[var(--niebla-clara)]'
                    }`}
                  >
                    Empezar
                  </Link>

                  <ul className="mt-6 space-y-2.5 text-[13px]">
                    <li className="flex items-center gap-2 text-[var(--ink-700)]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                      <span>{pluralServices(plan.max_services)}</span>
                    </li>
                    <li className="flex items-center gap-2 text-[var(--ink-700)]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                      <span>{pluralReservations(plan.max_reservations_per_month)}</span>
                    </li>
                    <li className="flex items-center gap-2 text-[var(--ink-700)]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                      <span>{pluralEmployees(plan.max_employees)}</span>
                    </li>
                    <li className="flex items-center gap-2 text-[var(--ink-700)]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                      <span>Página de reservas online</span>
                    </li>
                    <li className="flex items-center gap-2 text-[var(--ink-700)]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                      <span>App cliente iOS + Android</span>
                    </li>
                    {plan.has_push_notifications && (
                      <li className="flex items-center gap-2 text-[var(--ink-700)]">
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                        Notificaciones push
                      </li>
                    )}
                    {plan.has_reminders && (
                      <li className="flex items-center gap-2 text-[var(--ink-700)]">
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                        Recordatorios automáticos
                      </li>
                    )}
                    {plan.has_reports && (
                      <li className="flex items-center gap-2 text-[var(--ink-700)]">
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                        Reportes en tiempo real
                      </li>
                    )}
                    {plan.slug === 'premium' && (
                      <li className="flex items-center gap-2 text-[var(--ink-700)]">
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" aria-hidden="true" />
                        Soporte prioritario
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-center text-[12px] text-[var(--ink-500)]">
            <Clock className="mr-1 inline h-3 w-3" aria-hidden="true" />
            Sin permanencia. Cambia o cancela cuando quieras.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[var(--brand-500)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] [background-size:24px_24px]"
        />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-[32px] font-extrabold tracking-[-0.02em] text-white sm:text-[40px]">
            Empieza hoy. Gratis.
          </h2>
          <p className="mt-3 text-[15px] text-white/85">
            Crea tu negocio en menos de 2 minutos. Sin tarjeta de crédito.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-[14px] font-semibold text-[var(--brand-700)] transition-[transform] duration-150 ease-out hover:bg-[var(--brand-50)] active:scale-[0.97]"
            >
              Crear mi cuenta
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-lg border border-white/30 bg-transparent px-5 text-[14px] font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-white/10 active:scale-[0.97]"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-soft)] bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--brand-500)] text-[10px] font-bold text-white">
              T
            </div>
            <span className="text-[13px] text-[var(--ink-600)]">
              © {new Date().getFullYear()} Turnly · Hecho en Ibarra.
            </span>
          </div>
          <div className="flex items-center gap-5 text-[13px] text-[var(--ink-500)]">
            <Link href="/terms" className="transition-colors duration-150 hover:text-[var(--ink-900)]">
              Términos
            </Link>
            <Link href="/privacy" className="transition-colors duration-150 hover:text-[var(--ink-900)]">
              Privacidad
            </Link>
            <Link href="/support" className="transition-colors duration-150 hover:text-[var(--ink-900)]">
              Soporte
            </Link>
            <Link href="/login" className="transition-colors duration-150 hover:text-[var(--ink-900)]">
              Iniciar sesión
            </Link>
            <Link href="/register" className="transition-colors duration-150 hover:text-[var(--ink-900)]">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
