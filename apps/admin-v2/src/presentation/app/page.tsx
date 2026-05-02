import Link from 'next/link';
import {
  Calendar,
  Bell,
  BarChart3,
  Globe,
  Users,
  Smartphone,
  Check,
  ArrowRight,
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

const features = [
  {
    icon: Calendar,
    title: 'Agenda online',
    desc: 'Tus clientes reservan 24/7 desde su celular. Sin llamadas, sin WhatsApp.',
  },
  {
    icon: Bell,
    title: 'Recordatorios automáticos',
    desc: 'Push y email un día antes y 2 horas antes. Reduce no-shows hasta 70%.',
  },
  {
    icon: BarChart3,
    title: 'Reportes en tiempo real',
    desc: 'Ingresos diarios, semanales, mensuales. Cash, tarjeta, transferencia.',
  },
  {
    icon: Globe,
    title: 'Página pública',
    desc: 'Tu propio link `turnly.app/tu-negocio`. Comparte en redes y bio.',
  },
  {
    icon: Users,
    title: 'Equipo y roles',
    desc: 'Cajeros, staff, admin. Cada uno ve lo que necesita.',
  },
  {
    icon: Smartphone,
    title: 'App cliente',
    desc: 'Tus clientes descargan la app, ven historial y agendan en segundos.',
  },
];

export default async function LandingPage() {
  const plans = await fetchPlans();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
              T
            </div>
            <span className="font-semibold text-zinc-900">Turnly</span>
          </div>
          <nav className="hidden gap-6 md:flex">
            <a href="#features" className="text-sm text-zinc-600 hover:text-zinc-900">
              Características
            </a>
            <a href="#pricing" className="text-sm text-zinc-600 hover:text-zinc-900">
              Planes
            </a>
            <Link href="/explorar" className="text-sm text-zinc-600 hover:text-zinc-900">
              Explorar negocios
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <span className="inline-flex items-center rounded-full bg-[var(--color-primary-muted)] px-3 py-1 text-xs font-medium text-[var(--color-primary-hover)]">
          Pensado para Ecuador
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">
          Tu negocio, tus reservas,
          <br />
          <span className="text-[var(--color-primary)]">en piloto automático.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600">
          Agenda online, recordatorios automáticos, reportes y página pública.
          Empieza gratis. Sin tarjeta.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-6 py-3 text-base font-medium text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Crear mi negocio
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#pricing"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Ver planes
          </a>
        </div>
        <p className="mt-6 text-xs text-zinc-500">
          Barberías · Spas · Clínicas · Gimnasios · Pet grooming · Car wash
        </p>
      </section>

      {/* Features */}
      <section id="features" className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Todo lo que tu negocio necesita
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              Sin instalación. Sin contratos. Cancela cuando quieras.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-zinc-900">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Planes simples, sin sorpresas
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              Empieza gratis. Crece cuando lo necesites.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan, idx) => {
              const popular = plan.slug === 'pro';
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border bg-white p-6 shadow-sm ${
                    popular
                      ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 relative'
                      : 'border-zinc-200'
                  }`}
                >
                  {popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white">
                      Más popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-zinc-900">{plan.name}</h3>
                  <p className="mt-1 min-h-[40px] text-xs text-zinc-500">
                    {plan.description}
                  </p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-zinc-900">
                      {plan.price === 0 ? 'Gratis' : `$${plan.price.toFixed(2)}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="ml-1 text-sm text-zinc-500">/mes</span>
                    )}
                  </div>
                  <Link
                    href="/register"
                    className={`mt-5 block w-full rounded-lg py-2 text-center text-sm font-medium transition-colors ${
                      popular
                        ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
                        : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    Empezar
                  </Link>
                  <ul className="mt-6 space-y-2 text-sm">
                    <li className="flex items-center gap-2 text-zinc-700">
                      <Check className="h-4 w-4 text-emerald-600" />
                      {formatLimit(plan.max_services)} servicios
                    </li>
                    <li className="flex items-center gap-2 text-zinc-700">
                      <Check className="h-4 w-4 text-emerald-600" />
                      {formatLimit(plan.max_reservations_per_month)} reservas/mes
                    </li>
                    <li className="flex items-center gap-2 text-zinc-700">
                      <Check className="h-4 w-4 text-emerald-600" />
                      {formatLimit(plan.max_employees)} empleados
                    </li>
                    {plan.has_push_notifications && (
                      <li className="flex items-center gap-2 text-zinc-700">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Notificaciones push
                      </li>
                    )}
                    {plan.has_reminders && (
                      <li className="flex items-center gap-2 text-zinc-700">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Recordatorios automáticos
                      </li>
                    )}
                    {plan.has_reports && (
                      <li className="flex items-center gap-2 text-zinc-700">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Reportes
                      </li>
                    )}
                    {plan.has_custom_page && (
                      <li className="flex items-center gap-2 text-zinc-700">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Página pública
                      </li>
                    )}
                  </ul>
                  {idx === -1 && null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[var(--color-primary)] py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Empieza hoy. Gratis.
          </h2>
          <p className="mt-4 text-lg text-white/90">
            Crea tu negocio en menos de 2 minutos. Sin tarjeta de crédito.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors"
          >
            Crear mi cuenta
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--color-primary)] text-xs font-bold text-white">
              T
            </div>
            <span className="text-sm text-zinc-600">
              © {new Date().getFullYear()} Turnly
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/terms" className="hover:text-zinc-900">
              Términos
            </Link>
            <Link href="/privacy" className="hover:text-zinc-900">
              Privacidad
            </Link>
            <Link href="/login" className="hover:text-zinc-900">
              Iniciar sesión
            </Link>
            <Link href="/register" className="hover:text-zinc-900">
              Registrarse
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
