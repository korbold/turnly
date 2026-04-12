'use client';

import { useQuery } from '@tanstack/react-query';
import { getVehicles } from '@/lib/api/vehicles';
import { getServices } from '@/lib/api/services';
import { getUsers } from '@/lib/api/users';
import { WalkInForm } from '@/components/wash-log/WalkInForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NewWashLogPage() {
  const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles', 'all'],
    queryFn: () => getVehicles({ per_page: 200 }),
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices({ per_page: 50 }),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => getUsers({ per_page: 100 }),
  });

  const isLoading = vehiclesLoading || servicesLoading || usersLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/wash-log">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrar lavado</h1>
          <p className="text-gray-500">Registro de cliente sin cita previa</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Cargando datos...</div>
      ) : (
        <WalkInForm
          vehicles={vehiclesData?.data ?? []}
          services={servicesData?.data ?? []}
          users={usersData?.data ?? []}
        />
      )}
    </div>
  );
}
