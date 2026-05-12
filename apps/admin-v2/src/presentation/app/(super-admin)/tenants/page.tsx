'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Search, MoreHorizontal, Ban, CheckCircle, LogIn, CreditCard } from 'lucide-react';
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
import { usePlans, useAssignPlan } from '@/presentation/hooks/use-plans';
import { useImpersonate } from '@/presentation/hooks/use-auth';
import { useRouter } from 'next/navigation';
import type { TenantStatus, BusinessType } from '@/domain/entities/tenant';

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  car_wash: 'Car Wash',
  barbershop: 'Barberia',
  medical: 'Medico',
  spa: 'Spa',
  gym: 'Gym',
  other: 'Otro',
};

const BUSINESS_TYPE_COLORS: Record<BusinessType, string> = {
  car_wash: 'bg-blue-50 text-blue-700 border-blue-200',
  barbershop: 'bg-orange-50 text-orange-700 border-orange-200',
  medical: 'bg-teal-50 text-teal-700 border-teal-200',
  spa: 'bg-purple-50 text-purple-700 border-purple-200',
  gym: 'bg-red-50 text-red-700 border-red-200',
  other: 'bg-zinc-50 text-zinc-600 border-zinc-200',
};

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
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<BusinessType | ''>('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSuperAdminTenants(page);
  const suspendTenant = useSuspendTenant();
  const activateTenant = useActivateTenant();
  const { data: plans } = usePlans();
  const assignPlan = useAssignPlan();
  const impersonate = useImpersonate();

  const tenants = data?.data ?? [];
  const meta = data?.meta;

  const filtered = tenants.filter((t) => {
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || t.status === statusFilter;
    const matchesType = !typeFilter || t.businessType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
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

  async function handleAssignPlan(tenantId: string, planId: string) {
    try {
      await assignPlan.mutateAsync({ tenantId, planId });
      toast.success('Plan asignado');
    } catch {
      toast.error('Error al asignar plan');
    }
  }

  async function handleImpersonate(tenantId: string) {
    try {
      await impersonate.mutateAsync(tenantId);
      router.push('/dashboard');
    } catch {
      toast.error('Error al entrar como tenant');
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
        <div className="flex flex-wrap gap-2">
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
        <div className="flex flex-wrap gap-2">
          {(['', 'car_wash', 'barbershop', 'medical', 'spa', 'gym', 'other'] as const).map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(t as BusinessType | '')}
            >
              {t ? BUSINESS_TYPE_LABELS[t] : 'Todos los tipos'}
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
                <TableHead>Tipo</TableHead>
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
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
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
                    <TableCell>
                      {tenant.businessType ? (
                        <Badge variant="outline" className={BUSINESS_TYPE_COLORS[tenant.businessType]}>
                          {BUSINESS_TYPE_LABELS[tenant.businessType]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{tenant.email}</TableCell>
                    <TableCell>
                      {tenant.isTrial ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          Trial
                          {tenant.trialEndsAt && (
                            <span className="ml-1">
                              ({Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000))}d)
                            </span>
                          )}
                        </Badge>
                      ) : tenant.plan ? (
                        <Badge variant="outline" className="text-xs">
                          {tenant.plan.name} — ${tenant.plan.price}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-zinc-100 text-zinc-500 border-zinc-200 text-xs">Sin plan</Badge>
                      )}
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
                          <DropdownMenuItem onClick={() => handleImpersonate(tenant.id)}>
                            <LogIn className="mr-2 h-4 w-4" />
                            Entrar como tenant
                          </DropdownMenuItem>
                          {plans && plans.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Asignar plan</div>
                              {plans.filter(p => p.isActive).map((plan) => (
                                <DropdownMenuItem
                                  key={plan.id}
                                  onClick={() => handleAssignPlan(tenant.id, plan.id)}
                                >
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  {plan.name} — {plan.price === 0 ? 'Gratis' : `$${plan.price}`}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
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
