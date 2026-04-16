'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { useSettings, useUpdateSettings } from '@/presentation/hooks/use-settings';

const ROLES = ['Admin', 'Cajero', 'Lavador', 'Cliente'] as const;
const SECTIONS = ['Dashboard', 'Reservas', 'Registro', 'Clientes', 'Servicios', 'Equipo', 'Reportes', 'Settings'] as const;

type Permission = 'full' | 'view' | 'none';

const PERMISSION_CYCLE: Permission[] = ['full', 'view', 'none'];
const PERMISSION_DISPLAY: Record<Permission, { icon: string; color: string }> = {
  full: { icon: '\u2705', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  view: { icon: '\uD83D\uDC41', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  none: { icon: '\u2500', color: 'bg-zinc-50 text-zinc-400 border-zinc-200' },
};

type PermissionsMatrix = Record<string, Record<string, Permission>>;

function buildDefaultMatrix(): PermissionsMatrix {
  const matrix: PermissionsMatrix = {};
  for (const role of ROLES) {
    matrix[role] = {};
    for (const section of SECTIONS) {
      matrix[role][section] = role === 'Admin' ? 'full' : 'none';
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
        <CardTitle className="text-sm font-medium">Matriz de Permisos</CardTitle>
        <p className="text-xs text-muted-foreground">
          Haz clic en cada celda para cambiar: Full → Vista → Sin acceso
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Rol</th>
              {SECTIONS.map((s) => (
                <th key={s} className="px-2 py-2 text-center font-medium text-muted-foreground">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{role}</td>
                {SECTIONS.map((section) => {
                  const perm = matrix[role]?.[section] ?? 'none';
                  const display = PERMISSION_DISPLAY[perm];
                  return (
                    <td key={section} className="px-2 py-2 text-center">
                      <button
                        onClick={() => cyclePermission(role, section)}
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors',
                          display.color
                        )}
                        title={`${role} - ${section}: ${perm}`}
                      >
                        {display.icon}
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
