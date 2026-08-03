'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useResetPassword } from '@/presentation/hooks/use-auth';

const schema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres').max(255, 'Demasiado largo'),
    passwordConfirmation: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((v) => v.password === v.passwordConfirmation, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirmation'],
  });

type FormValues = z.infer<typeof schema>;

function InvalidLink() {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 shadow-[0_1px_2px_0_rgba(15,18,26,0.05)] sm:p-8 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
      <h1 className="text-[26px] font-bold tracking-[-0.01em] text-[var(--ink-900)] sm:text-[28px]">
        Enlace no válido
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-muted)]">
        El enlace no es válido o expiró. Solicita uno nuevo desde &quot;Olvidé mi contraseña&quot;.
      </p>
      <Link
        href="/forgot-password"
        className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--brand-700)] transition-colors duration-150 hover:text-[var(--brand-600)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Solicitar un nuevo enlace
      </Link>
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const reset = useResetPassword();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', passwordConfirmation: '' },
  });

  if (!token || !email) return <InvalidLink />;

  const onSubmit = (data: FormValues) => {
    setApiError(null);
    reset.mutate(
      { email, token, password: data.password },
      {
        onSuccess: () => {
          toast.success('Contraseña actualizada. Inicia sesión.');
          router.push('/login');
        },
        onError: (error: { message?: string; code?: string }) => {
          setApiError(
            error.code === 'INVALID_RESET_TOKEN'
              ? 'El enlace no es válido o expiró. Solicita uno nuevo.'
              : error.message || 'No se pudo actualizar la contraseña. Intenta de nuevo.'
          );
        },
      }
    );
  };

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 shadow-[0_1px_2px_0_rgba(15,18,26,0.05)] sm:p-8 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
      <header className="mb-6 lg:mb-8">
        <h1 className="text-[26px] font-bold tracking-[-0.01em] text-[var(--ink-900)] sm:text-[28px]">
          Nueva contraseña
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--fg-muted)]">
          Crea una nueva contraseña para <strong className="text-[var(--ink-900)]">{email}</strong>.
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
          <Label htmlFor="password">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
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

        <div className="space-y-1.5">
          <Label htmlFor="passwordConfirmation">Confirmar contraseña</Label>
          <Input
            id="passwordConfirmation"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            aria-invalid={!!errors.passwordConfirmation}
            {...register('passwordConfirmation')}
          />
          {errors.passwordConfirmation && (
            <p className="text-xs text-[var(--danger-500)]">{errors.passwordConfirmation.message}</p>
          )}
        </div>

        <Button type="submit" className="h-11 w-full" disabled={reset.isPending}>
          {reset.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Actualizando...
            </>
          ) : (
            'Actualizar contraseña'
          )}
        </Button>

        <p className="pt-1 text-center text-[13px] text-[var(--fg-muted)]">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-medium text-[var(--brand-700)] transition-colors duration-150 hover:text-[var(--brand-600)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a iniciar sesión
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
