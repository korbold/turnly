'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { getUsers, updateUserRole, inviteUser } from '@/lib/api/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

const ROLES = [
  { value: 'tenant_admin', label: 'Admin' },
  { value: 'cashier', label: 'Cajero' },
  { value: 'washer', label: 'Operador' },
];

const roleBadgeColors: Record<string, string> = {
  tenant_admin: 'bg-purple-100 text-purple-800',
  cashier: 'bg-blue-100 text-blue-800',
  washer: 'bg-green-100 text-green-800',
};

const roleLabels: Record<string, string> = {
  tenant_admin: 'Admin',
  cashier: 'Cajero',
  washer: 'Operador',
};

interface InviteFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
}

const emptyInviteForm: InviteFormData = {
  name: '',
  email: '',
  password: '',
  role: '',
  phone: '',
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>(emptyInviteForm);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers({ per_page: 100 }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setInviteDialogOpen(false);
      setInviteForm(emptyInviteForm);
      setInviteError(null);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const message = err?.response?.data?.error?.message ?? 'Error al invitar al miembro';
      setInviteError(message);
    },
  });

  const users = data?.data ?? [];

  function openInvite() {
    setInviteForm(emptyInviteForm);
    setInviteError(null);
    setInviteDialogOpen(true);
  }

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    inviteMutation.mutate({
      name: inviteForm.name,
      email: inviteForm.email,
      password: inviteForm.password,
      role: inviteForm.role,
      phone: inviteForm.phone || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
          <p className="text-gray-500">Gestión de miembros del equipo</p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger render={<Button onClick={openInvite} />}>
            <Plus className="h-4 w-4 mr-1" />
            Invitar miembro
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invitar miembro</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nombre</label>
                <Input
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                <Input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Contraseña</label>
                <Input
                  required
                  type="password"
                  minLength={8}
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Rol</label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
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
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Teléfono (opcional)
                </label>
                <Input
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>
              {inviteError && (
                <p className="text-sm text-red-600">{inviteError}</p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending || !inviteForm.role}>
                  {inviteMutation.isPending ? 'Invitando...' : 'Invitar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? 'Cargando...' : `${users.length} miembro${users.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando equipo...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay miembros registrados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol actual</TableHead>
                  <TableHead>Cambiar rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-gray-500">{user.email}</TableCell>
                    <TableCell>
                      {user.role ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeColors[user.role] ?? 'bg-gray-100 text-gray-800'}`}
                        >
                          {roleLabels[user.role] ?? user.role}
                        </span>
                      ) : (
                        <Badge variant="secondary">Sin rol</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role ?? ''}
                        onValueChange={(value) => {
                          if (value) {
                            updateRoleMutation.mutate({ userId: user.id, role: value });
                          }
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Seleccionar rol">
                            {roleLabels[user.role ?? ''] ?? 'Seleccionar rol'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
