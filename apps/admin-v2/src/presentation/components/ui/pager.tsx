'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

interface PagerProps {
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  /** Cómo llamar a lo que se está contando, en plural. */
  noun?: string;
}

/**
 * Devuelve los números a dibujar, con `null` donde va una elipsis. Con pocas
 * páginas salen todas; con muchas, siempre la primera, la última y el entorno
 * de la actual, para que la barra no crezca en un teléfono.
 */
function pageWindow(current: number, last: number): (number | null)[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const around = [current - 1, current, current + 1].filter((p) => p > 1 && p < last);
  const pages = [1, ...around, last];

  return pages.flatMap((page, i) => {
    const prev = pages[i - 1];
    return prev !== undefined && page - prev > 1 ? [null, page] : [page];
  });
}

export function Pager({
  currentPage,
  lastPage,
  total,
  perPage,
  onPageChange,
  noun = 'resultados',
}: PagerProps) {
  if (total === 0) return null;

  const rangeStart = (currentPage - 1) * perPage + 1;
  const rangeEnd = Math.min(currentPage * perPage, total);

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-[13px] tabular-nums text-[var(--fg-secondary)]">
        {total <= perPage
          ? `${total} ${noun}`
          : `Mostrando ${rangeStart}–${rangeEnd} de ${total}`}
      </p>

      {lastPage > 1 && (
        <nav className="flex items-center gap-1" aria-label="Paginación">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Página anterior"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>

          {pageWindow(currentPage, lastPage).map((page, i) =>
            page === null ? (
              <span
                key={`gap-${i}`}
                className="px-1 text-[13px] text-[var(--fg-muted)]"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                className="h-8 min-w-8 px-2 tabular-nums"
                aria-label={`Página ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Página siguiente"
            disabled={currentPage >= lastPage}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  );
}
