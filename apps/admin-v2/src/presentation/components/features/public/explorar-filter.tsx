'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

const TYPES = [
  { value: '', label: 'Todos' },
  { value: 'barbershop', label: 'Barbería' },
  { value: 'spa', label: 'Spa' },
  { value: 'medical', label: 'Clínica' },
  { value: 'gym', label: 'Gimnasio' },
  { value: 'car_wash', label: 'Car wash' },
  { value: 'other', label: 'Otro' },
];

interface Props {
  initialQuery: string;
  initialType: string;
}

export function ExplorarFilter({ initialQuery, initialType }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  const [, startTransition] = useTransition();

  const debouncedQuery = useDebounced(query, 300);

  const targetUrl = useMemo(() => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    if (debouncedQuery.trim()) sp.set('q', debouncedQuery.trim());
    else sp.delete('q');
    if (type) sp.set('type', type);
    else sp.delete('type');
    const qs = sp.toString();
    return qs ? `/explorar?${qs}` : '/explorar';
  }, [debouncedQuery, type, searchParams]);

  useEffect(() => {
    startTransition(() => {
      router.replace(targetUrl, { scroll: false });
    });
  }, [targetUrl, router]);

  return (
    <div className="mx-auto mt-8 max-w-2xl space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca por nombre o ciudad..."
          aria-label="Buscar negocio"
          className="h-12 w-full rounded-xl border border-[var(--border-firm)] bg-white pl-10 pr-10 text-[14px] text-[var(--ink-900)] shadow-[0_1px_2px_0_rgba(15,18,26,0.05)] placeholder:text-[var(--fg-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]/20"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--fg-muted)] transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--niebla-media)] active:scale-[0.94]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
        role="tablist"
        aria-label="Tipo de negocio"
      >
        {TYPES.map((t) => {
          const active = (type || '') === t.value;
          return (
            <button
              key={t.value || 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setType(t.value)}
              className={`snap-start shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
                active
                  ? 'border-transparent bg-[var(--brand-500)] text-white'
                  : 'border-[var(--border-soft)] bg-white text-[var(--ink-600)] hover:border-[var(--border-firm)] hover:text-[var(--ink-900)]'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
