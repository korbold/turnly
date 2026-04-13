'use client';

import { useQuery } from '@tanstack/react-query';
import { getClientResources } from '@/lib/api/client-resources';
import { getServices } from '@/lib/api/services';
import { getUsers } from '@/lib/api/users';
import { WalkInForm } from '@/components/service-log/WalkInForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NewServiceLogPage() {
  const { data: clientResourcesData, isLoading: clientResourcesLoading } = useQuery({
    queryKey: ['client-resources', 'all'],
    queryFn: () => getClientResources({ per_page: 200 }),
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices({ per_page: 50 }),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () => getUsers({ per_page: 100, exclude_role: 'client' }),
  });

  const isLoading = clientResourcesLoading || servicesLoading || usersLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/service-log">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrar servicio</h1>
          <p className="text-gray-500">Registro de cliente sin cita previa</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Cargando datos...</div>
      ) : (
        <WalkInForm
          clientResources={clientResourcesData?.data ?? []}
          services={servicesData?.data ?? []}
          users={usersData?.data ?? []}
        />
      )}
    </div>
  );
}
