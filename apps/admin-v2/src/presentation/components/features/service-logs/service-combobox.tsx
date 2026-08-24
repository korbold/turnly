'use client';

import { useState } from 'react';
import { Check, ChevronDown, Wrench } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/presentation/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/presentation/components/ui/popover';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import type { Service } from '@/domain/entities/service';
import { formatCounterCurrency } from '@/shared/utils/format';

interface ServiceComboboxProps {
  services: Service[];
  selected: Service | null;
  recentIds?: string[];
  isLoading?: boolean;
  onSelect: (service: Service) => void;
  placeholder?: string;
}

const money = formatCounterCurrency;

/**
 * Service picker built on the cmdk Command primitive — type-ahead
 * filter, keyboard nav, virtualized list. Replaces the 2x4 card grid so
 * the surface stays usable when the tenant grows past a handful of
 * services. Recent picks (last used) get pinned to the top so the
 * cashier's most common keystroke is just Enter.
 */
export function ServiceCombobox({
  services,
  selected,
  recentIds = [],
  isLoading = false,
  onSelect,
  placeholder = 'Buscar servicio…',
}: ServiceComboboxProps) {
  const [open, setOpen] = useState(false);

  const activeServices = services.filter((s) => s.isActive);
  // Maintain `recentIds` order rather than sorting alphabetically — the
  // operator's muscle memory is "the last one I picked is on top".
  const recent = recentIds
    .map((id) => activeServices.find((s) => s.id === id))
    .filter((s): s is Service => Boolean(s));
  const recentSet = new Set(recent.map((s) => s.id));
  const others = activeServices.filter((s) => !recentSet.has(s.id));

  if (isLoading) {
    return <Skeleton className="h-10 w-full rounded-md" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between cursor-pointer',
            !selected && 'text-[var(--fg-muted)]',
          )}
        >
          {selected ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--brand-50)] text-[var(--brand-700)]">
                <Wrench className="h-3 w-3" aria-hidden="true" />
              </span>
              <span className="truncate text-[var(--fg-strong)]">{selected.name}</span>
              <span
                className="ml-auto shrink-0 font-mono text-[12.5px] tabular-nums text-[var(--fg-secondary)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {money(selected.price)}
              </span>
            </span>
          ) : (
            <span className="flex flex-1 items-center gap-2">
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{placeholder}</span>
            </span>
          )}
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>
              <div className="px-3 py-6 text-center text-[12.5px] text-[var(--fg-muted)]">
                No se encontró ningún servicio.
              </div>
            </CommandEmpty>

            {recent.length > 0 && (
              <>
                <CommandGroup heading="Recientes">
                  {recent.map((svc) => (
                    <ServiceRow
                      key={svc.id}
                      service={svc}
                      active={selected?.id === svc.id}
                      onPick={() => {
                        onSelect(svc);
                        setOpen(false);
                      }}
                    />
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading={recent.length > 0 ? 'Todos' : undefined}>
              {others.map((svc) => (
                <ServiceRow
                  key={svc.id}
                  service={svc}
                  active={selected?.id === svc.id}
                  onPick={() => {
                    onSelect(svc);
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

function ServiceRow({
  service,
  active,
  onPick,
}: {
  service: Service;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <CommandItem
      key={service.id}
      value={service.name}
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
      <span className="flex-1 truncate text-[var(--fg-strong)]">{service.name}</span>
      <span
        className="font-mono text-[12.5px] tabular-nums text-[var(--fg-secondary)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {money(service.price)}
      </span>
    </CommandItem>
  );
}
