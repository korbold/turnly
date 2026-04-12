'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTenantSettings, updateTenantSettings } from '@/lib/api/tenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PLAN_LABELS: Record<string, string> = {
  trial: 'Prueba',
  basic: 'Básico',
  pro: 'Pro',
};

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-gray-100 text-gray-800',
  basic: 'bg-blue-100 text-blue-800',
  pro: 'bg-purple-100 text-purple-800',
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [settingsJson, setSettingsJson] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: tenantSettings, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: getTenantSettings,
  });

  const settings = tenantSettings as Record<string, unknown> | null | undefined;

  useEffect(() => {
    if (settings?.settings) {
      try {
        setSettingsJson(JSON.stringify(settings.settings, null, 2));
      } catch {
        setSettingsJson('{}');
      }
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSave() {
    try {
      const parsed = JSON.parse(settingsJson);
      setJsonError(null);
      updateMutation.mutate({ settings: parsed });
    } catch {
      setJsonError('JSON inválido. Por favor revisa el formato.');
    }
  }

  const tenant = settings?.tenant as Record<string, unknown> | undefined;
  const businessName = (tenant?.name ?? settings?.name ?? '—') as string;
  const plan = (tenant?.plan ?? settings?.plan ?? '') as string;
  const email = (tenant?.email ?? settings?.email ?? '—') as string;
  const city = (tenant?.city ?? settings?.city ?? null) as string | null;
  const country = (tenant?.country ?? settings?.country ?? '') as string;
  const phone = (tenant?.phone ?? settings?.phone ?? null) as string | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500">Ajustes del negocio</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando configuración...</div>
      ) : (
        <>
          {/* Business Info */}
          <Card>
            <CardHeader>
              <CardTitle>Información del negocio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Nombre</p>
                  <p className="font-medium text-lg">{businessName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Plan</p>
                  <div className="mt-1">
                    {plan ? (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[plan] ?? 'bg-gray-100 text-gray-800'}`}
                      >
                        {PLAN_LABELS[plan] ?? plan}
                      </span>
                    ) : (
                      <Badge variant="secondary">Sin plan</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                  <p className="font-medium">{email}</p>
                </div>
                {phone && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Teléfono</p>
                    <p className="font-medium">{phone}</p>
                  </div>
                )}
                {city && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Ciudad</p>
                    <p className="font-medium">{city}</p>
                  </div>
                )}
                {country && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">País</p>
                    <p className="font-medium">{country}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Settings JSON */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración avanzada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Edita la configuración en formato JSON. Cambios incorrectos pueden afectar el funcionamiento del sistema.
              </p>
              <textarea
                className="w-full font-mono text-sm border border-gray-200 rounded-lg p-3 h-48 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={settingsJson}
                onChange={(e) => {
                  setSettingsJson(e.target.value);
                  setJsonError(null);
                }}
                spellCheck={false}
              />
              {jsonError && (
                <p className="text-sm text-red-600">{jsonError}</p>
              )}
              {saved && (
                <p className="text-sm text-green-600">Configuración guardada correctamente.</p>
              )}
              {updateMutation.isError && (
                <p className="text-sm text-red-600">
                  Error al guardar. Por favor intenta de nuevo.
                </p>
              )}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
