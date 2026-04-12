'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { verifyTenant } from '@/lib/api/onboarding';
import { MailCheck } from 'lucide-react';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    setError(null);
    setLoading(true);
    try {
      const tenantId = localStorage.getItem('onboarding_tenant_id') ?? '';
      await verifyTenant(tenantId);
      router.push('/configure');
    } catch (err: unknown) {
      const apiError = err as { message?: string };
      setError(apiError?.message ?? 'Error al activar la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paso 2: Verificación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <div className="flex justify-center">
          <MailCheck className="h-16 w-16 text-blue-500" />
        </div>
        <p className="text-gray-600">
          Hemos enviado un correo de verificación a tu dirección de email.
        </p>
        <p className="text-sm text-gray-500">
          En este entorno de desarrollo, puedes activar tu cuenta directamente sin necesidad del enlace de email.
        </p>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">{error}</div>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleActivate} disabled={loading}>
          {loading ? 'Activando...' : 'Activar mi cuenta'}
        </Button>
      </CardFooter>
    </Card>
  );
}
