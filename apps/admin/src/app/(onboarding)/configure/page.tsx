'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function ConfigurePage() {
  const router = useRouter();

  const handleContinue = () => {
    router.push('/welcome');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paso 3: Configuración</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <div className="flex justify-center">
          <Settings className="h-16 w-16 text-blue-500" />
        </div>
        <p className="text-gray-700 font-medium">Tu negocio está listo</p>
        <p className="text-sm text-gray-500">
          Puedes configurar tus servicios, horarios y más desde el panel de administración una vez que hayas completado el registro.
        </p>
        <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-md text-left space-y-1">
          <p className="font-medium">Próximos pasos sugeridos:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-600">
            <li>Agregar servicios</li>
            <li>Configurar horarios de atención</li>
            <li>Invitar a tu equipo</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleContinue}>
          Continuar
        </Button>
      </CardFooter>
    </Card>
  );
}
