'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/presentation/components/ui/card';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { useRegister } from '@/presentation/hooks/use-auth';
import api from '@/infrastructure/api/client';

interface BusinessCategory {
  id: string;
  slug: string;
  name: string;
  emoji?: string | null;
}

const registerSchema = z.object({
  businessName: z.string().min(1, 'El nombre del negocio es requerido'),
  businessType: z.string().min(1, 'Selecciona el tipo de negocio'),
  name: z.string().min(1, 'Tu nombre es requerido'),
  email: z.string().min(1, 'El email es requerido').email('Email inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(8, 'Mínimo 8 caracteres'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const registerMutation = useRegister();
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: categories = [], isLoading: loadingCategories } = useQuery<
    BusinessCategory[]
  >({
    queryKey: ['business-categories'],
    queryFn: async () => {
      const { data } = await api.get('/public/categories');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      businessName: '',
      businessType: '',
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    setApiError(null);
    registerMutation.mutate(
      {
        name: data.name,
        email: data.email,
        password: data.password,
        businessName: data.businessName,
        businessType: data.businessType,
      },
      {
        onSuccess: () => {
          sessionStorage.setItem('pendingVerifyEmail', data.email);
          router.push('/verify-email');
        },
        onError: (error: Error) => {
          setApiError(
            error.message || 'Error al crear la cuenta. Intenta de nuevo.'
          );
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Crear mi negocio</CardTitle>
        <CardDescription>Crea tu negocio en 30 segundos</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {apiError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {apiError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="businessName">Nombre del negocio</Label>
            <Input
              id="businessName"
              placeholder="Mi Negocio"
              {...register('businessName')}
            />
            {errors.businessName && (
              <p className="text-sm text-red-500">
                {errors.businessName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessType">Tipo de negocio</Label>
            <Controller
              name="businessType"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={loadingCategories}
                >
                  <SelectTrigger id="businessType">
                    <SelectValue
                      placeholder={
                        loadingCategories ? 'Cargando...' : 'Selecciona una opción'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.slug}>
                        {cat.emoji ? `${cat.emoji} ` : ''}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.businessType && (
              <p className="text-sm text-red-500">
                {errors.businessType.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Tu nombre</Label>
            <Input
              id="name"
              placeholder="Juan Pérez"
              autoComplete="name"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
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
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando negocio...
              </>
            ) : (
              'Crear mi negocio'
            )}
          </Button>

          <p className="text-center text-sm text-zinc-500">
            ¿Ya tienes cuenta?{' '}
            <Link
              href="/login"
              className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              Inicia sesión
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
