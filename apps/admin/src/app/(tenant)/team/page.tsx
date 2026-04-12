'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, updateUserRole } from '@/lib/api/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

const ROLES = [
  { value: 'tenant_admin', label: 'Admin' },
  { value: 'cashier', label: 'Cajero' },
  { value: 'washer', label: 'Lavador' },
];

const roleBadgeColors: Record<string, string> = {
  tenant_admin: 'bg-purple-100 text-purple-800',
  cashier: 'bg-blue-100 text-blue-800',
  washer: 'bg-green-100 text-green-800',
};

const roleLabels: Record<string, string> = {
  tenant_admin: 'Admin',
  cashier: 'Cajero',
  washer: 'Lavador',
};

export default function TeamPage() {
  const queryClient = useQueryClient();

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

  const users = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
        <p className="text-gray-500">Gestión de miembros del equipo</p>
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
