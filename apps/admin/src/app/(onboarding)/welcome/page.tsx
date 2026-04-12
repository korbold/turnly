'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PartyPopper } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();
  const [slug, setSlug] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('onboarding_slug') ?? '';
    setSlug(stored);
  }, []);

  const handleGoToDashboard = () => {
    if (slug) {
      localStorage.setItem('tenant_slug', slug);
    }
    router.push('/dashboard');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Paso 5: ¡Listo!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <div className="flex justify-center">
          <PartyPopper className="h-16 w-16 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">¡Tu negocio está activo!</h2>
        <p className="text-gray-600">
          Ya puedes comenzar a gestionar tu negocio.
        </p>
        {slug && (
          <div className="bg-gray-100 rounded-md p-3 text-sm">
            <p className="text-gray-500 mb-1">Tu URL personalizada:</p>
            <p className="font-mono font-medium text-gray-800">
              {slug}.turnly.app
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleGoToDashboard}>
          Ir al panel de administración
        </Button>
      </CardFooter>
    </Card>
  );
}
