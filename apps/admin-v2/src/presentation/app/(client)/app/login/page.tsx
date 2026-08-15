'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useRequestMagicLink } from '@/presentation/hooks/use-client-portal';
import { apiErrorMessage } from '@/shared/utils/api-error';

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestLink = useRequestMagicLink();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    requestLink.mutate(email.trim().toLowerCase(), {
      onSuccess: () => setSent(true),
      onError: (err) => setError(apiErrorMessage(err, 'No pudimos enviar el link. Intenta de nuevo.')),
    });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg-app)] px-4">
      <div className="w-full max-w-sm">
        <h1
          className="text-[26px] font-bold leading-tight text-[var(--fg-strong)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {sent ? 'Revisa tu correo' : 'Entra a tus reservas'}
        </h1>

        {sent ? (
          <>
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--success-700)]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[var(--fg-strong)]">
                  Te enviamos un link a {email}
                </p>
                <p className="mt-1 text-[13px] text-[var(--fg-secondary)]">
                  Ábrelo desde este mismo teléfono y entras sin contraseña. Vence en una hora.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => {
                setSent(false);
                setError(null);
              }}
            >
              Usar otro correo
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-[14px] text-[var(--fg-secondary)]">
              Escribe tu correo y te mandamos un link para entrar. Sin contraseñas.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <Label className="mb-1.5">Correo</Label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]"
                    aria-hidden="true"
                  />
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    className="pl-9"
                    placeholder="tucorreo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="text-[13px] text-[var(--danger-700)]">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!email.trim() || requestLink.isPending}
              >
                {requestLink.isPending ? 'Enviando…' : 'Enviarme el link'}
                {!requestLink.isPending && <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />}
              </Button>
            </form>
          </>
        )}

        <p className="mt-8 text-center text-[13px] text-[var(--fg-secondary)]">
          ¿Buscas negocios?{' '}
          <Link href="/explorar" className="font-semibold text-[var(--brand-700)]">
            Explorar
          </Link>
        </p>
      </div>
    </div>
  );
}
