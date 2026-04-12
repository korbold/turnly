'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlugChecker } from '@/components/onboarding/SlugChecker';
import { registerTenant } from '@/lib/api/onboarding';

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  slug: z
    .string()
    .min(3, 'El slug debe tener al menos 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  owner_name: z.string().min(2, 'El nombre del dueño es requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  phone: z.string().optional(),
  city: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const slugValue = watch('slug', '');

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    setLoading(true);
    try {
      const result = await registerTenant(data);
      const tenantId = result.data?.tenant?.id;
      if (tenantId) {
        localStorage.setItem('onboarding_tenant_id', String(tenantId));
      }
      if (data.slug) {
        localStorage.setItem('onboarding_slug', data.slug);
      }
      router.push('/verify-email');
    } catch (err: unknown) {
      const apiError = err as { message?: string; fieldErrors?: Record<string, string[]> };
      if (apiError?.fieldErrors) {
        const messages = Object.values(apiError.fieldErrors).flat().join('. ');
        setError(messages);
      } else {
        setError(apiError?.message ?? 'Error al registrar el negocio');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paso 1: Registro</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nombre del negocio</Label>
            <Input
              id="name"
              placeholder="Mi negocio"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL del negocio)</Label>
            <Input
              id="slug"
              placeholder="mi-car-wash"
              {...register('slug')}
            />
            <SlugChecker slug={slugValue} />
            {errors.slug && (
              <p className="text-sm text-red-500">{errors.slug.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_name">Nombre del dueño</Label>
            <Input
              id="owner_name"
              placeholder="Juan Pérez"
              {...register('owner_name')}
            />
            {errors.owner_name && (
              <p className="text-sm text-red-500">{errors.owner_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="juan@negocio.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono (opcional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 234 567 8900"
              {...register('phone')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Ciudad (opcional)</Label>
            <Input
              id="city"
              placeholder="Ciudad de México"
              {...register('city')}
            />
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
