'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getServices } from '@/lib/api/services';

export default function ConfigurePage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-services'],
    queryFn: () => getServices({ per_page: 50 }),
  });

  const services = data?.data ?? [];

  const handleContinue = () => {
    router.push('/welcome');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paso 4: Tus servicios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600 text-sm">
          Hemos creado estos servicios sugeridos para tu negocio.
          Puedes modificarlos después en Configuración.
        </p>
        {isLoading ? (
          <div className="text-center py-6 text-gray-400 text-sm">Cargando servicios...</div>
        ) : services.length === 0 ? (
          <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-500 text-center">
            No se crearon servicios sugeridos
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 overflow-hidden">
            {services.map((service) => (
              <li key={service.id} className="flex items-center justify-between px-4 py-3 bg-white">
                <span className="text-gray-800 font-medium">{service.name}</span>
                <span className="text-gray-500 text-sm">${parseFloat(service.price).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleContinue}>
          Continuar
        </Button>
      </CardFooter>
    </Card>
  );
}
