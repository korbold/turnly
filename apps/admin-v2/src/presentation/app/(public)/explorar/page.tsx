import Link from 'next/link';
import { ArrowRight, MapPin, Search, Sparkles } from 'lucide-react';
import { ExplorarFilter } from '@/presentation/components/features/public/explorar-filter';

export const dynamic = 'force-dynamic';

interface PublicTenant {
  slug: string;
  name: string;
  description: string | null;
  business_type: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string | null;
  phone: string | null;
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  barbershop: 'Barbería',
  spa: 'Spa',
  medical: 'Clínica',
  gym: 'Gimnasio',
  car_wash: 'Car wash',
  other: 'Servicio',
};

const BUSINESS_TYPE_PALETTES: Record<string, { bg: string; fg: string }> = {
  barbershop: { bg: 'var(--brand-50)', fg: 'var(--brand-700)' },
  spa: { bg: '#FAE8FF', fg: '#A21CAF' },
  medical: { bg: '#E4F1FE', fg: '#1666BF' },
  gym: { bg: '#E8F8F0', fg: '#0B7A44' },
  car_wash: { bg: '#FFF6E0', fg: '#B47114' },
  other: { bg: 'var(--niebla-clara)', fg: 'var(--ink-600)' },
};

async function fetchTenants(params: { q?: string; type?: string }): Promise<PublicTenant[]> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.type) search.set('business_type', params.type);
  const url = `${base}/public/tenants${search.toString() ? `?${search}` : ''}`;
  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { data: PublicTenant[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function ExplorarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const type = params.type ?? '';

  const tenants = await fetchTenants({ q: query, type });

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
            <Link
              href="/#features"
              className="text-[13px] text-[var(--ink-600)] transition-colors duration-150 hover:text-[var(--ink-900)]"
            >
              Características
            </Link>
            <Link
              href="/#pricing"
              className="text-[13px] text-[var(--ink-600)] transition-colors duration-150 hover:text-[var(--ink-900)]"
            >
              Planes
            </Link>
            <Link
              href="/explorar"
              className="text-[13px] font-semibold text-[var(--brand-700)]"
            >
              Explorar negocios
            </Link>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="text-[13px] text-[var(--ink-600)] transition-colors duration-150 hover:text-[var(--ink-900)]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center rounded-lg bg-[var(--brand-500)] px-3.5 text-[13px] font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--brand-600)] active:scale-[0.97]"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--border-soft)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[var(--brand-500)] opacity-[0.06] blur-3xl"
        />
        <div className="relative mx-auto max-w-5xl px-5 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-200)] bg-white/70 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--brand-700)]">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Negocios en Turnly
          </span>
          <h1 className="mt-4 text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--ink-900)] sm:text-[48px]">
            Encuentra y reserva con un toque.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--ink-600)]">
            Barberías, spas, clínicas y más. Mira horarios y agenda al instante.
          </p>

          {/* Filter bar */}
          <ExplorarFilter initialQuery={query} initialType={type} />
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        {tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-soft)] bg-white py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--niebla-clara)] text-[var(--fg-muted)]">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold text-[var(--ink-900)]">
              Sin resultados
            </h2>
            <p className="mt-1 max-w-sm text-[13.5px] text-[var(--ink-500)]">
              {query || type
                ? 'Prueba otra búsqueda o quita los filtros.'
                : 'Aún no hay negocios listados. Vuelve pronto.'}
            </p>
            {(query || type) && (
              <Link
                href="/explorar"
                className="mt-4 inline-flex h-9 items-center rounded-lg border border-[var(--border-firm)] bg-white px-4 text-[13px] font-medium text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--niebla-clara)]"
              >
                Limpiar filtros
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-[var(--ink-900)]">
                <span className="font-mono tabular-nums">{tenants.length}</span>{' '}
                {tenants.length === 1 ? 'negocio' : 'negocios'}
                {query ? ` para "${query}"` : ''}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tenants.map((t) => {
                const palette =
                  BUSINESS_TYPE_PALETTES[t.business_type ?? 'other'] ??
                  BUSINESS_TYPE_PALETTES.other;
                const label = BUSINESS_TYPE_LABELS[t.business_type ?? 'other'] ?? 'Servicio';
                return (
                  <Link
                    key={t.slug}
                    href={`/${t.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-8px_rgba(15,18,26,0.12),0_4px_8px_-4px_rgba(15,18,26,0.06)]"
                  >
                    {/* Cover */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--niebla-clara)]">
                      {t.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.cover_url}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-[44px] font-extrabold tracking-[-0.04em]"
                          style={{ backgroundColor: palette.bg, color: palette.fg }}
                        >
                          {getInitials(t.name)}
                        </div>
                      )}
                      <span
                        className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-0.5 text-[10.5px] font-semibold backdrop-blur-sm"
                        style={{ color: palette.fg }}
                      >
                        {label}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start gap-3">
                        {t.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.logo_url}
                            alt={t.name}
                            className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border-soft)] bg-white object-contain p-1"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
                            style={{ backgroundColor: palette.bg, color: palette.fg }}
                          >
                            {getInitials(t.name)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[15px] font-semibold text-[var(--ink-900)]">
                            {t.name}
                          </h3>
                          {t.address && (
                            <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--ink-500)]">
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{t.address}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {t.description && (
                        <p className="mt-3 line-clamp-2 text-[13px] leading-snug text-[var(--ink-600)]">
                          {t.description}
                        </p>
                      )}

                      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3">
                        <span className="text-[12px] font-medium text-[var(--ink-500)]">
                          turnly.app/{t.slug}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--brand-700)] transition-colors duration-150 group-hover:text-[var(--brand-600)]">
                          Reservar
                          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
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
