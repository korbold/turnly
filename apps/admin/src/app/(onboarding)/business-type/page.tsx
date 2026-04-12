'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BUSINESS_TYPES } from '@/lib/constants/business-types';
import { setBusinessType } from '@/lib/api/onboarding';

export default function BusinessTypePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      await setBusinessType({ business_type: selected, create_suggested_services: true });
      router.push('/configure');
    } catch (err: unknown) {
      const apiError = err as { message?: string; fieldErrors?: Record<string, string[]> };
      if (apiError?.fieldErrors) {
        const messages = Object.values(apiError.fieldErrors).flat().join('. ');
        setError(messages);
      } else {
        setError(apiError?.message ?? 'Error al guardar el tipo de negocio');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paso 3: Tipo de negocio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          Selecciona el tipo de negocio para pre-cargar servicios sugeridos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BUSINESS_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = selected === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setSelected(type.value)}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-12 w-12 shrink-0 text-gray-600" />
                <div>
                  <p className="font-semibold text-gray-900">{type.label}</p>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">{error}</div>
        )}
        <Button
          className="w-full"
          disabled={!selected || loading}
          onClick={handleContinue}
        >
          {loading ? 'Guardando...' : 'Continuar'}
        </Button>
      </CardContent>
    </Card>
  );
}
