'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Eye, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { useSettings, useUpdateSettings } from '@/presentation/hooks/use-settings';
import { DEFAULT_PERMISSIONS, PRIVILEGES } from '@/shared/constants/permissions';
import { washerLabel } from '@/shared/constants/roles';

const ROLES = ['Admin', 'Cajero', 'Lavador', 'Cliente'] as const;
// Column order mirrors the sidebar so the matrix reads like the menu it
// governs. Every module the sidebar can show needs a column here —
// otherwise it is silently ungrantable to cashier/washer.
const SECTIONS = [
  'Dashboard', 'Reservas', 'Registro', 'Clientes', 'Servicios', 'Inventario',
  'Equipo', 'Reportes', 'Facturas', 'Plan', 'Config',
] as const;

type Permission = 'full' | 'view' | 'none';

const PERMISSION_CYCLE: Permission[] = ['full', 'view', 'none'];
// A privilege is granted or it isn't — "solo lectura" says nothing about
// being allowed to name a price, so those two columns skip it.
const PRIVILEGE_CYCLE: Permission[] = ['full', 'none'];
const PERMISSION_LABEL: Record<Permission, string> = {
  full: 'Acceso completo',
  view: 'Solo lectura',
  none: 'Sin acceso',
};
// A privilege reads as a yes/no, not as a level of access.
const PRIVILEGE_LABEL: Record<Permission, string> = {
  full: 'Permitido',
  view: 'Permitido',
  none: 'No permitido',
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

function MatrixCell({
  perm,
  label,
  onClick,
  divider = false,
}: {
  perm: Permission;
  label: string;
  onClick: () => void;
  divider?: boolean;
}) {
  const { Icon, className } = PERMISSION_DISPLAY[perm];

  return (
    <td className={cn('px-2 py-2 text-center', divider && 'border-l border-[var(--border-soft)]')}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(42,109,244,0.20)] focus-visible:ring-offset-1',
          className,
        )}
        aria-label={label}
        title={label}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    </td>
  );
}

// The matrix keys are persisted inside the tenant's settings JSON, so
// 'Lavador' stays the key forever; only what the owner reads changes with
// the trade (Barbero, Terapeuta, Entrenador…).
function roleLabel(role: string, businessType: Parameters<typeof washerLabel>[0]): string {
  return role === 'Lavador' ? washerLabel(businessType) : role;
}

function buildDefaultMatrix(): PermissionsMatrix {
  const matrix: PermissionsMatrix = {};
  for (const role of ROLES) {
    matrix[role] = {};
    for (const column of [...SECTIONS, ...PRIVILEGES]) {
      matrix[role][column] = DEFAULT_PERMISSIONS[role]?.[column] ?? 'none';
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
      const cycle = (PRIVILEGES as readonly string[]).includes(section)
        ? PRIVILEGE_CYCLE
        : PERMISSION_CYCLE;
      const current = prev[role]?.[section] ?? 'none';
      // indexOf is -1 for a value outside this column's cycle (a matrix saved
      // when the column still had three states) → lands on index 0, 'full'.
      const nextIdx = (cycle.indexOf(current) + 1) % cycle.length;
      const next = cycle[nextIdx];
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
          Las dos últimas columnas son permisos sueltos dentro del Registro
          Diario — se dan o no se dan.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            {/* Two tiers: the modules answer "what can this role open", the
                privileges "what may it do once inside". Same storage, but
                reading them as one flat row invites granting the price by
                accident while aiming for a menu item. */}
            <tr className="bg-[var(--niebla-clara,#F4F5F7)]">
              <th />
              <th
                colSpan={SECTIONS.length}
                className="px-2 pt-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]"
              >
                Módulos
              </th>
              <th
                colSpan={PRIVILEGES.length}
                className="border-l border-[var(--border-soft)] px-2 pt-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]"
              >
                Registro Diario
              </th>
            </tr>
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
              {PRIVILEGES.map((p, i) => (
                <th
                  key={p}
                  className={cn(
                    'px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]',
                    i === 0 && 'border-l border-[var(--border-soft)]',
                  )}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role} className="border-b border-[var(--border-soft)] last:border-0">
                <td className="px-4 py-2 text-sm font-medium text-[var(--fg-default,#2E3441)]">
                  {roleLabel(role, settings?.businessType)}
                </td>
                {SECTIONS.map((section) => {
                  const perm = matrix[role]?.[section] ?? 'none';
                  return (
                    <MatrixCell
                      key={section}
                      perm={perm}
                      label={`${roleLabel(role, settings?.businessType)} · ${section}: ${PERMISSION_LABEL[perm]}`}
                      onClick={() => cyclePermission(role, section)}
                    />
                  );
                })}
                {PRIVILEGES.map((privilege, i) => {
                  const perm = matrix[role]?.[privilege] ?? 'none';
                  return (
                    <MatrixCell
                      key={privilege}
                      perm={perm}
                      divider={i === 0}
                      label={`${roleLabel(role, settings?.businessType)} · ${privilege}: ${PRIVILEGE_LABEL[perm]}`}
                      onClick={() => cyclePermission(role, privilege)}
                    />
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
