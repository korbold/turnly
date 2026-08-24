'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Users } from 'lucide-react';
import api from '@/infrastructure/api/client';
import { Input } from '@/presentation/components/ui/input';
import { cn } from '@/shared/utils/cn';

export interface Person {
  id: string;
  name: string;
  phone?: string | null;
  resourcesInTenant: number;
}

interface Props {
  /** El nombre tecleado. El componente no lo posee: lo edita el formulario. */
  value: string;
  onChange: (name: string) => void;
  /** Una persona elegida de la lista, o null si se está escribiendo una nueva. */
  selected: Person | null;
  onSelect: (person: Person | null) => void;
  placeholder?: string;
  autoCapitalize?: (v: string) => string;
}

/**
 * Elegir a la persona en vez de escribir su nombre suelto.
 *
 * El campo sigue siendo opcional —en una lavadora el 90% de los lavados no
 * necesita persona, y la pantalla se usa con el auto adelante y la cola
 * esperando— pero el cliente repetido, que es el que acumula deuda, queda
 * ligado con un toque en vez de crear una persona nueva cada vez.
 *
 * Sin esto, "Gaby Arellano" escrito dos veces son dos personas, y su deuda
 * queda partida entre sus autos sin nada que la sume.
 */
export function PersonPicker({
  value,
  onChange,
  selected,
  onSelect,
  placeholder = 'Ej. Gaby Arellano',
  autoCapitalize,
}: Props) {
  const [resultados, setResultados] = useState<Person[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const q = value.trim();
  // El backend ignora menos de 3 letras; pedirlo igual es ruido.
  const puedeBuscar = !selected && q.length >= 3;
  // Derivado y no borrado dentro del efecto: limpiar estado ahí encadena
  // renders, y acá alcanza con no mostrar lo que ya no aplica.
  const visibles = puedeBuscar ? resultados : [];

  useEffect(() => {
    if (!puedeBuscar) return;

    let vigente = true;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const { data } = await api.get<{ data: Array<Record<string, unknown>> }>(
          '/clients/search',
          { params: { q } },
        );
        if (!vigente) return;
        setResultados(
          (data.data ?? []).map((p) => ({
            id: p.id as string,
            name: p.name as string,
            phone: (p.phone as string | null) ?? null,
            resourcesInTenant: Number(p.resources_in_tenant ?? 0),
          })),
        );
        setAbierto(true);
      } catch {
        // Buscar es una ayuda, no un requisito: si falla, se escribe el
        // nombre y el backend crea la persona igual.
        if (vigente) setResultados([]);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);

    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q, puedeBuscar]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--brand-500)] bg-[var(--brand-50)] px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-medium text-[var(--brand-700)]">
            {selected.name}
          </p>
          <p className="text-[11.5px] text-[var(--fg-muted)]">
            {selected.resourcesInTenant === 0
              ? 'Sin vehículos todavía'
              : `${selected.resourcesInTenant} vehículo${selected.resourcesInTenant === 1 ? '' : 's'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onChange('');
          }}
          className="shrink-0 text-[12px] font-medium text-[var(--fg-muted)] hover:underline"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const v = autoCapitalize ? autoCapitalize(e.target.value) : e.target.value;
          onChange(v);
        }}
        onFocus={() => visibles.length > 0 && setAbierto(true)}
      />

      {buscando && (
        <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-[var(--fg-muted)]" />
      )}

      {abierto && visibles.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1 shadow-lg">
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  onChange(p.name);
                  setAbierto(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
                  'hover:bg-[var(--bg-hover)]',
                )}
              >
                <Users className="h-3.5 w-3.5 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-[var(--fg-strong)]">
                    {p.name}
                  </span>
                  <span className="block text-[11.5px] text-[var(--fg-muted)]">
                    {p.resourcesInTenant === 0
                      ? 'Sin vehículos'
                      : `${p.resourcesInTenant} vehículo${p.resourcesInTenant === 1 ? '' : 's'}`}
                    {p.phone ? ` · ${p.phone}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}

          <li className="border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
            >
              <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Crear «{value.trim()}»
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
