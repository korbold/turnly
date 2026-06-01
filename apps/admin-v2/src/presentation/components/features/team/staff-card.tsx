'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AtSign, Mail, Phone, MoreVertical, KeyRound, Copy, Check, RefreshCw, Eye, EyeOff } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { useChangeRole, useResetPassword } from '@/presentation/hooks/use-team';
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

function generatePassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : undefined;
  if (cryptoObj) {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  } else {
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

interface StaffCardProps {
  user: User;
}

export function StaffCard({ user }: StaffCardProps) {
  const changeRoleMutation = useChangeRole();
  const resetPasswordMutation = useResetPassword();
  const { data: settings } = useSettings();
  const businessType = settings?.businessType ?? null;
  const role = user.role ?? 'client';
  const roleCfg = getRoleConfig(role, businessType);

  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState(() => generatePassword());
  const [resetDone, setResetDone] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

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

  function openReset() {
    setResetPassword(generatePassword());
    setResetDone(null);
    setShowPassword(false);
    setCopied(false);
    setResetOpen(true);
  }

  function confirmReset() {
    if (!resetPassword || resetPassword.length < 6) {
      toast.error('Mínimo 6 caracteres');
      return;
    }
    resetPasswordMutation.mutate(
      { id: user.id, password: resetPassword },
      {
        onSuccess: () => {
          toast.success('Contraseña actualizada');
          setResetDone(resetPassword);
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo actualizar');
        },
      }
    );
  }

  async function copyCreds() {
    if (!resetDone) return;
    const text = `Turnly\nUsuario: ${user.username ?? user.email ?? ''}\nContraseña: ${resetDone}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('No se pudo copiar');
    }
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
          {user.username && (
            <span className="inline-flex items-center gap-1">
              <AtSign className="h-3 w-3" aria-hidden="true" />
              <span className="truncate font-mono">{user.username}</span>
            </span>
          )}
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

      <div className="flex items-center gap-2">
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

        {role !== 'client' && role !== 'owner' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Más acciones">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openReset}>
                <KeyRound className="mr-2 h-4 w-4" />
                Resetear contraseña
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

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

      <Dialog open={resetOpen} onOpenChange={(o) => !o && setResetOpen(false)}>
        <DialogContent className="sm:max-w-md">
          {resetDone ? (
            <>
              <DialogHeader>
                <DialogTitle>Contraseña actualizada</DialogTitle>
                <DialogDescription>
                  Entrega esta nueva contraseña a {user.name}. Sus sesiones activas se cerraron.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Usuario</div>
                  <div className="font-mono text-base">{user.username ?? user.email}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Contraseña</div>
                  <div className="font-mono text-base">{resetDone}</div>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={copyCreds}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
                <Button onClick={() => setResetOpen(false)}>Listo</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Resetear contraseña</DialogTitle>
                <DialogDescription>
                  Define una nueva contraseña para {user.name}. Se cerrarán sus sesiones activas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Nueva contraseña</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setResetPassword(generatePassword())}
                    title="Generar nueva"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={confirmReset} disabled={resetPasswordMutation.isPending}>
                  Actualizar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}
