'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { useInviteUser } from '@/presentation/hooks/use-team';
import type { UserRole } from '@/domain/entities/user';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'tenant_admin', label: 'Administrador' },
  { value: 'cashier', label: 'Cajero' },
  { value: 'washer', label: 'Lavador' },
];

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteModal({ open, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('washer');
  const inviteMutation = useInviteUser();

  function handleClose() {
    setEmail('');
    setRole('washer');
    onClose();
  }

  function handleSubmit() {
    if (!email) return;
    inviteMutation.mutate(
      { email, role },
      {
        onSuccess: () => {
          toast.success('Invitacion enviada');
          handleClose();
        },
        onError: () => toast.error('Error al enviar invitacion'),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar Miembro</DialogTitle>
          <DialogDescription>
            Envia una invitacion por correo electronico
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5">Correo electronico</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
            />
          </div>

          <div>
            <Label className="mb-1.5">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!email || inviteMutation.isPending}>
            Enviar invitacion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
