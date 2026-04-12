'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTenants,
  suspendTenant,
  activateTenant,
  type SuperAdminTenant,
} from '@/lib/api/super-admin';
import { BUSINESS_TYPES } from '@/lib/constants/business-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
};

function getBusinessTypeLabel(value: string): string {
  return BUSINESS_TYPES.find((bt) => bt.value === value)?.label ?? value;
}

export default function TenantsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'tenants'],
    queryFn: () => getTenants({ per_page: 100 }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => suspendTenant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenants'] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateTenant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenants'] });
    },
  });

  const tenants: SuperAdminTenant[] = data?.data ?? [];

  function handleEnter(tenant: SuperAdminTenant) {
    localStorage.setItem('tenant_slug', tenant.slug);
    localStorage.setItem('super_admin_mode', 'true');
    router.push('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Negocios</h1>
        <p className="text-gray-500">Gestión de todos los negocios registrados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? 'Cargando...' : `${tenants.length} negocio${tenants.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando negocios...</div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay negocios registrados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{getBusinessTypeLabel(tenant.business_type)}</TableCell>
                    <TableCell className="capitalize">{tenant.plan}</TableCell>
                    <TableCell>
                      <Badge
                        className={STATUS_STYLES[tenant.status] ?? 'bg-gray-100 text-gray-800'}
                      >
                        {STATUS_LABELS[tenant.status] ?? tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{tenant.email}</TableCell>
                    <TableCell>
                      {new Date(tenant.created_at).toLocaleDateString('es')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {tenant.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={suspendMutation.isPending}
                            onClick={() => suspendMutation.mutate(tenant.id)}
                          >
                            Suspender
                          </Button>
                        )}
                        {(tenant.status === 'suspended' || tenant.status === 'pending') && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={activateMutation.isPending}
                            onClick={() => activateMutation.mutate(tenant.id)}
                          >
                            Activar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleEnter(tenant)}
                        >
                          Entrar
                        </Button>
                      </div>
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
