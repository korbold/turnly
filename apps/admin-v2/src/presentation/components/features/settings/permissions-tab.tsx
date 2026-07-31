'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Eye, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { useSettings, useUpdateSettings } from '@/presentation/hooks/use-settings';
import { DEFAULT_PERMISSIONS } from '@/shared/constants/permissions';

const ROLES = ['Admin', 'Cajero', 'Lavador', 'Cliente'] as const;
const SECTIONS = ['Dashboard', 'Reservas', 'Registro', 'Clientes', 'Servicios', 'Equipo', 'Reportes', 'Config'] as const;

type Permission = 'full' | 'view' | 'none';

const PERMISSION_CYCLE: Permission[] = ['full', 'view', 'none'];
const PERMISSION_LABEL: Record<Permission, string> = {
  full: 'Acceso completo',
  view: 'Solo lectura',
  none: 'Sin acceso',
};
const PERMISSION_DISPLAY: Record<
  Permission,
  { Icon: typeof Check; className: string }
> = {
  full: {
    Icon: Check,
    className:
      'bg-[#E8F8F0] text-[#0B7A44] border-[#BCE7CD] hover:bg-[#DCF2E5]',
  },
  view: {
    Icon: Eye,
    className:
      'bg-[#FFF6E0] text-[#B47114] border-[#F2DDA7] hover:bg-[#FBEFC8]',
  },
  none: {
    Icon: Minus,
    className:
      'bg-[var(--niebla-clara,#F4F5F7)] text-[var(--fg-muted)] border-[var(--border-soft,#E4E7EC)] hover:bg-[var(--niebla-media,#EEF0F3)]',
  },
};

type PermissionsMatrix = Record<string, Record<string, Permission>>;

function buildDefaultMatrix(): PermissionsMatrix {
  const matrix: PermissionsMatrix = {};
  for (const role of ROLES) {
    matrix[role] = {};
    for (const section of SECTIONS) {
      matrix[role][section] = DEFAULT_PERMISSIONS[role]?.[section] ?? 'none';
    }
  }
  return matrix;
}

export function PermissionsTab() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [matrix, setMatrix] = useState<PermissionsMatrix>(buildDefaultMatrix());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (settings?.permissions) {
      const merged = buildDefaultMatrix();
      for (const [role, sections] of Object.entries(settings.permissions)) {
        if (merged[role]) {
          for (const [section, perm] of Object.entries(sections)) {
            if (merged[role][section] !== undefined) {
              merged[role][section] = perm as Permission;
            }
          }
        }
      }
      setMatrix(merged);
    }
  }, [settings]);

  const autoSave = useCallback(
    (newMatrix: PermissionsMatrix) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await update.mutateAsync({ permissions: newMatrix as Record<string, Record<string, string>> });
          toast.success('Permisos guardados');
        } catch {
          toast.error('Error al guardar permisos');
        }
      }, 1000);
    },
    [update]
  );

  function cyclePermission(role: string, section: string) {
    setMatrix((prev) => {
      const current = prev[role]?.[section] ?? 'none';
      const nextIdx = (PERMISSION_CYCLE.indexOf(current) + 1) % PERMISSION_CYCLE.length;
      const next = PERMISSION_CYCLE[nextIdx];
      const newMatrix = {
        ...prev,
        [role]: { ...prev[role], [section]: next },
      };
      autoSave(newMatrix);
      return newMatrix;
    });
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold">Matriz de permisos</CardTitle>
        <p className="text-xs text-[var(--fg-muted)]">
          Haz clic en una celda para alternar: completo · solo lectura · sin acceso.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-soft)] bg-[var(--niebla-clara,#F4F5F7)]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Rol
              </th>
              {SECTIONS.map((s) => (
                <th
                  key={s}
                  className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]"
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role} className="border-b border-[var(--border-soft)] last:border-0">
                <td className="px-4 py-2 text-sm font-medium text-[var(--fg-default,#2E3441)]">
                  {role}
                </td>
                {SECTIONS.map((section) => {
                  const perm = matrix[role]?.[section] ?? 'none';
                  const display = PERMISSION_DISPLAY[perm];
                  const Icon = display.Icon;
                  return (
                    <td key={section} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => cyclePermission(role, section)}
                        className={cn(
                          'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(42,109,244,0.20)] focus-visible:ring-offset-1',
                          display.className
                        )}
                        aria-label={`${role}, ${section}: ${PERMISSION_LABEL[perm]}`}
                        title={`${role} · ${section}: ${PERMISSION_LABEL[perm]}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
