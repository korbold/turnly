'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Search, MoreHorizontal, Ban, CheckCircle, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/presentation/components/ui/input';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/presentation/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import {
  useSuperAdminTenants,
  useSuspendTenant,
  useActivateTenant,
} from '@/presentation/hooks/use-super-admin';
import type { TenantStatus } from '@/domain/entities/tenant';

const STATUS_COLORS: Record<TenantStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const STATUS_LABELS: Record<TenantStatus, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
};

export default function TenantsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSuperAdminTenants(page);
  const suspendTenant = useSuspendTenant();
  const activateTenant = useActivateTenant();

  const tenants = data?.data ?? [];
  const meta = data?.meta;

  const filtered = tenants.filter((t) => {
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleSuspend(id: string) {
    try {
      await suspendTenant.mutateAsync(id);
      toast.success('Tenant suspendido');
    } catch {
      toast.error('Error al suspender');
    }
  }

  async function handleActivate(id: string) {
    try {
      await activateTenant.mutateAsync(id);
      toast.success('Tenant activado');
    } catch {
      toast.error('Error al activar');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tenants</h1>
        <p className="text-sm text-muted-foreground">Gestiona todos los negocios de la plataforma</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['', 'active', 'pending', 'suspended'] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s as TenantStatus | '')}
            >
              {s ? STATUS_LABELS[s] : 'Todos'}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No se encontraron tenants
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{tenant.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{tenant.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[tenant.status]}>
                        {STATUS_LABELS[tenant.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tenant.createdAt), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {tenant.status === 'active' ? (
                            <DropdownMenuItem onClick={() => handleSuspend(tenant.id)}>
                              <Ban className="mr-2 h-4 w-4 text-rose-500" />
                              Suspender
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleActivate(tenant.id)}>
                              <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
                              Activar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => console.log('Enter tenant:', tenant.slug)}>
                            <LogIn className="mr-2 h-4 w-4" />
                            Entrar como tenant
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {meta.currentPage} de {meta.lastPage} ({meta.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.currentPage >= meta.lastPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
