'use client';

import { useQuery } from '@tanstack/react-query';
import { getUsers, type SuperAdminUser } from '@/lib/api/super-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function UsersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'users'],
    queryFn: () => getUsers({ per_page: 100 }),
  });

  const users: SuperAdminUser[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <p className="text-gray-500">Todos los usuarios del sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? 'Cargando...' : `${users.length} usuario${users.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando usuarios...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay usuarios registrados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Negocio(s)</TableHead>
                  <TableHead>Super Admin</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.tenants && user.tenants.length > 0
                        ? user.tenants.map((t) => t.name).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {user.is_super_admin && (
                        <Badge className="bg-purple-100 text-purple-800">
                          Super Admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('es')}
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
