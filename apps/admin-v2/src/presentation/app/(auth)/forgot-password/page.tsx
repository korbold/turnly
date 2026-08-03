'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, ArrowLeft, Loader2, Mail } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useRequestPasswordReset } from '@/presentation/hooks/use-auth';

const schema = z.object({
  email: z.string().min(1, 'Ingresa tu correo').email('Correo inválido').max(255, 'Demasiado largo'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const request = useRequestPasswordReset();
  const [apiError, setApiError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = (data: FormValues) => {
    setApiError(null);
    const email = data.email.trim();
    request.mutate(email, {
      onSuccess: () => setSentTo(email),
      onError: (error: { message?: string; code?: string; status?: number }) => {
        if (error.code === 'BUSINESS_NOT_FOUND' || error.status === 404) {
          setApiError('No encontramos un negocio con ese correo.');
          return;
        }
        setApiError(error.message || 'No se pudo enviar el enlace. Intenta de nuevo.');
      },
    });
  };

  if (sentTo) {
    return (
      <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 shadow-[0_1px_2px_0_rgba(15,18,26,0.05)] sm:p-8 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-[var(--brand-700)]">
          <Mail className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-[26px] font-bold tracking-[-0.01em] text-[var(--ink-900)] sm:text-[28px]">
          Revisa tu correo
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-muted)]">
          Te enviamos un enlace a <strong className="text-[var(--ink-900)]">{sentTo}</strong> para
          restablecer tu contraseña. El enlace expira en 1 hora.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--brand-700)] transition-colors duration-150 hover:text-[var(--brand-600)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 shadow-[0_1px_2px_0_rgba(15,18,26,0.05)] sm:p-8 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
      <header className="mb-6 lg:mb-8">
        <h1 className="text-[26px] font-bold tracking-[-0.01em] text-[var(--ink-900)] sm:text-[28px]">
          Olvidé mi contraseña
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--fg-muted)]">
          Ingresa el correo de tu negocio y te enviaremos un enlace para restablecerla.
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
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@correo.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-[var(--danger-500)]">{errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="h-11 w-full" disabled={request.isPending}>
          {request.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Enviando enlace...
            </>
          ) : (
            'Enviar enlace'
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
