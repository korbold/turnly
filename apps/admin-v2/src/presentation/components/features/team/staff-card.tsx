'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Mail, Phone } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { useChangeRole } from '@/presentation/hooks/use-team';
import { useSettings } from '@/presentation/hooks/use-settings';
import type { User, UserRole } from '@/domain/entities/user';
import type { BusinessType } from '@/domain/entities/tenant';

interface RoleCfg {
  label: string;
  fg: string;
  bg: string;
}

const ROLE_BASE: Record<UserRole, RoleCfg> = {
  owner: {
    label: 'Propietario',
    fg: 'text-[var(--brand-700)]',
    bg: 'bg-[var(--brand-50)]',
  },
  tenant_admin: {
    label: 'Admin',
    fg: 'text-[var(--info-700)]',
    bg: 'bg-[var(--info-50)]',
  },
  cashier: {
    label: 'Cajero',
    fg: 'text-[var(--warning-700)]',
    bg: 'bg-[var(--warning-50)]',
  },
  washer: {
    label: 'Operario',
    fg: 'text-[var(--success-700)]',
    bg: 'bg-[var(--success-50)]',
  },
  client: {
    label: 'Cliente',
    fg: 'text-[var(--fg)]',
    bg: 'bg-[var(--bg-sunken)]',
  },
};

const WASHER_LABEL_BY_BUSINESS: Partial<Record<BusinessType, string>> = {
  car_wash: 'Lavador',
  barbershop: 'Barbero',
  spa: 'Terapeuta',
  medical: 'Asistente',
  gym: 'Entrenador',
  other: 'Operario',
};

const ROLES: UserRole[] = ['owner', 'tenant_admin', 'cashier', 'washer', 'client'];

function getRoleConfig(role: UserRole, businessType: BusinessType | null): RoleCfg {
  const base = ROLE_BASE[role] ?? ROLE_BASE.client;
  if (role === 'washer' && businessType && WASHER_LABEL_BY_BUSINESS[businessType]) {
    return { ...base, label: WASHER_LABEL_BY_BUSINESS[businessType]! };
  }
  return base;
}

interface StaffCardProps {
  user: User;
}

export function StaffCard({ user }: StaffCardProps) {
  const changeRoleMutation = useChangeRole();
  const { data: settings } = useSettings();
  const businessType = settings?.businessType ?? null;
  const role = user.role ?? 'client';
  const roleCfg = getRoleConfig(role, businessType);

  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function confirmRoleChange() {
    if (!pendingRole) return;
    changeRoleMutation.mutate(
      { id: user.id, role: pendingRole },
      {
        onSuccess: () => {
          toast.success('Rol actualizado');
          setPendingRole(null);
        },
        onError: () => {
          toast.error('No se pudo cambiar el rol');
          setPendingRole(null);
        },
      }
    );
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center">
      <Avatar className="h-11 w-11 shrink-0">
        <AvatarFallback className="bg-[var(--ink-75)] text-[13px] font-semibold text-[var(--fg-strong)]">
          {initials || '?'}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px] font-semibold leading-snug text-[var(--fg-strong)]">
            {user.name}
          </p>
          <span
            className={cn(
              'whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em]',
              roleCfg.bg,
              roleCfg.fg
            )}
          >
            {roleCfg.label}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-[var(--fg-secondary)]">
          {user.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" aria-hidden="true" />
              <span className="truncate">{user.email}</span>
            </span>
          )}
          {user.phone && (
            <span
              className="inline-flex items-center gap-1 tabular-nums"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <Phone className="h-3 w-3" aria-hidden="true" />
              <span>{user.phone}</span>
            </span>
          )}
        </div>
      </div>

      <Select
        value={role}
        onValueChange={(v) => {
          if (v !== role) setPendingRole(v as UserRole);
        }}
        disabled={role === 'owner' || changeRoleMutation.isPending}
      >
        <SelectTrigger className="h-9 w-full text-[13px] sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {getRoleConfig(r, businessType).label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={!!pendingRole} onOpenChange={(o) => !o && setPendingRole(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar rol</DialogTitle>
            <DialogDescription>
              {pendingRole && (
                <>
                  ¿Cambiar el rol de{' '}
                  <span className="font-semibold text-[var(--fg-strong)]">{user.name}</span>{' '}
                  de{' '}
                  <span className="font-semibold text-[var(--fg-strong)]">{roleCfg.label}</span>{' '}
                  a{' '}
                  <span className="font-semibold text-[var(--fg-strong)]">
                    {getRoleConfig(pendingRole, businessType).label}
                  </span>
                  ? Sus permisos cambiarán al instante.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRole(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmRoleChange} disabled={changeRoleMutation.isPending}>
              Sí, cambiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
