'use client';

import { useState } from 'react';
import { Check, ChevronDown, Package } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/presentation/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/presentation/components/ui/popover';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/shared/utils/cn';
import type { Product } from '@/domain/entities/product';
import { formatCounterCurrency } from '@/shared/utils/format';
import { filterService } from './service-combobox';

interface ProductComboboxProps {
  products: Product[];
  /** Ya en el ticket: se marcan con el check y elegirlos otra vez suma 1. */
  addedIds?: string[];
  onSelect: (product: Product) => void;
  placeholder?: string;
}

const money = formatCounterCurrency;

/**
 * Mismo picker que ServiceCombobox, para productos. El Select plano listaba
 * el inventario entero sin búsqueda y con decenas de productos no había
 * forma de encontrar uno sin recorrer la lista a mano. A diferencia del de
 * servicios no guarda selección: cada elección agrega una línea al ticket.
 */
export function ProductCombobox({
  products,
  addedIds = [],
  onSelect,
  placeholder = 'Agregar producto…',
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const added = new Set(addedIds);

  return (
    // `modal` por lo mismo que en ServiceCombobox: vive dentro de un diálogo
    // y sin su propio bloqueo de scroll la rueda no mueve la lista.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between cursor-pointer text-[var(--fg-muted)]"
        >
          <span className="flex flex-1 items-center gap-2">
            <Package className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="truncate">{placeholder}</span>
          </span>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command filter={filterService}>
          <CommandInput placeholder="Buscar producto por nombre o código…" />
          <CommandList>
            <CommandEmpty>
              <div className="px-3 py-6 text-center text-[12.5px] text-[var(--fg-muted)]">
                {products.length === 0
                  ? 'No hay productos vendibles en el inventario.'
                  : 'No se encontró ningún producto.'}
              </div>
            </CommandEmpty>

            <CommandGroup>
              {products.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  active={added.has(p.id)}
                  onPick={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ProductRow({
  product,
  active,
  onPick,
}: {
  product: Product;
  active: boolean;
  onPick: () => void;
}) {
  const onHand = product.stock?.onHand ?? null;
  return (
    <CommandItem
      // El id y no el nombre, igual que en ServiceRow: dos productos con el
      // mismo nombre se pisaban en cmdk. La búsqueda va por keywords.
      value={product.id}
      keywords={[product.name, product.sku ?? '', product.description ?? '']}
      onSelect={onPick}
      className="flex items-center gap-2 cursor-pointer"
    >
      <Check
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-[var(--brand-600)]' : 'text-transparent',
        )}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[var(--fg-strong)]">{product.name}</span>
        {onHand !== null && (
          <span
            className={cn(
              'text-[11.5px] tabular-nums',
              onHand <= 0 ? 'text-[var(--danger-700)]' : 'text-[var(--fg-muted)]',
            )}
          >
            {onHand} en stock
          </span>
        )}
      </span>
      <span
        className="font-mono text-[12.5px] tabular-nums text-[var(--fg-secondary)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {money(product.price)}
      </span>
    </CommandItem>
  );
}
