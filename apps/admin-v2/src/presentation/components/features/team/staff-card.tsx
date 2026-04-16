'use client';

import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Mail, Phone } from 'lucide-react';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { Badge } from '@/presentation/components/ui/badge';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { cn } from '@/shared/utils/cn';
import { useChangeRole } from '@/presentation/hooks/use-team';
import type { User, UserRole } from '@/domain/entities/user';

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string }> = {
  tenant_admin: { label: 'Admin', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  cashier: { label: 'Cajero', color: 'text-amber-600', bg: 'bg-amber-50' },
  washer: { label: 'Lavador', color: 'text-sky-600', bg: 'bg-sky-50' },
  client: { label: 'Cliente', color: 'text-zinc-600', bg: 'bg-zinc-100' },
};

const ROLES: UserRole[] = ['tenant_admin', 'cashier', 'washer', 'client'];

interface StaffCardProps {
  user: User;
}

export function StaffCard({ user }: StaffCardProps) {
  const changeRoleMutation = useChangeRole();
  const role = user.role ?? 'client';
  const roleCfg = ROLE_CONFIG[role];
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function handleRoleChange(newRole: string) {
    changeRoleMutation.mutate(
      { id: user.id, role: newRole as UserRole },
      {
        onSuccess: () => toast.success('Rol actualizado'),
        onError: () => toast.error('Error al cambiar rol'),
      }
    );
  }

  return (
    <motion.div whileHover={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <Card className="transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-indigo-100 text-sm font-medium text-indigo-700">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <Badge className={cn('shrink-0 border-0 text-[10px]', roleCfg.bg, roleCfg.color)}>
                  {roleCfg.label}
                </Badge>
              </div>

              <div className="mt-1 space-y-0.5">
                {user.email && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{user.email}</span>
                  </div>
                )}
                {user.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{user.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Inline role change */}
          <div className="mt-3">
            <Select value={role} onValueChange={handleRoleChange} disabled={changeRoleMutation.isPending}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_CONFIG[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
