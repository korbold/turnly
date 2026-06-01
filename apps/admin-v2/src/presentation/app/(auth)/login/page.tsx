'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useLogin } from '@/presentation/hooks/use-auth';
import { authStorage } from '@/infrastructure/storage/auth-storage';

const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Ingresa tu usuario o correo')
    .max(255, 'Demasiado largo'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(6, 'Mínimo 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = (data: LoginFormValues) => {
    setApiError(null);
    login.mutate(data, {
      onSuccess: () => {
        const isSuperAdmin = authStorage.getIsSuperAdmin();
        router.push(isSuperAdmin ? '/super-admin' : '/dashboard');
      },
      onError: (error: { message?: string; code?: string }) => {
        if (error.code === 'EMAIL_NOT_VERIFIED' && data.identifier.includes('@')) {
          sessionStorage.setItem('pendingVerifyEmail', data.identifier);
          router.push('/verify-email');
          return;
        }
        setApiError(
          error.message || 'Error al iniciar sesión. Verifica tus credenciales.'
        );
      },
    });
  };

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 shadow-[0_1px_2px_0_rgba(15,18,26,0.05)] sm:p-8 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
      <header className="mb-6 lg:mb-8">
        <h1 className="text-[26px] font-bold tracking-[-0.01em] text-[var(--ink-900)] sm:text-[28px]">
          Iniciar sesión
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--fg-muted)]">
          Bienvenido de vuelta. Ingresa para continuar.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {apiError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[#FBC9CE] bg-[#FCE9EB] px-3 py-2.5 text-[13px] text-[#A91D2C]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{apiError}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="identifier">Usuario o correo</Label>
          <Input
            id="identifier"
            type="text"
            placeholder="juan o juan@correo.com"
            autoComplete="username"
            aria-invalid={!!errors.identifier}
            {...register('identifier')}
          />
          {errors.identifier && (
            <p className="text-xs text-[var(--danger-500)]">{errors.identifier.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              href="/forgot-password"
              className="text-[12px] font-medium text-[var(--brand-700)] transition-colors duration-150 hover:text-[var(--brand-600)]"
            >
              ¿La olvidaste?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              className="pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--fg-muted)] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[var(--niebla-media,#EEF0F3)] hover:text-[var(--fg-default,#2E3441)] active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(42,109,244,0.20)]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-[var(--danger-500)]">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={login.isPending}
        >
          {login.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Iniciando sesión...
            </>
          ) : (
            'Iniciar sesión'
          )}
        </Button>

        <p className="pt-1 text-center text-[13px] text-[var(--fg-muted)]">
          ¿Aún no tienes cuenta?{' '}
          <Link
            href="/register"
            className="font-medium text-[var(--brand-700)] transition-colors duration-150 hover:text-[var(--brand-600)]"
          >
            Crear cuenta
          </Link>
        </p>
      </form>
    </div>
  );
}
