'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useGoogleLogin, useRequestMagicLink } from '@/presentation/hooks/use-client-portal';
import { authStorage } from '@/infrastructure/storage/auth-storage';
import { isGoogleSignInConfigured, signInWithGoogle } from '@/lib/firebase/google-auth';
import { apiErrorMessage } from '@/shared/utils/api-error';
import {
  TurnstileWidget,
  isTurnstileEnabled,
} from '@/presentation/components/features/security/turnstile-widget';

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const requestLink = useRequestMagicLink();
  const googleLogin = useGoogleLogin();

  async function handleGoogle() {
    setError(null);
    setGooglePending(true);
    try {
      const idToken = await signInWithGoogle();
      const session = await googleLogin.mutateAsync(idToken);
      authStorage.setToken(session.token);
      router.replace('/app');
    } catch (e) {
      // Closing the popup is a normal cancel, not a failure worth shouting about.
      const code = (e as { code?: string })?.code ?? '';
      if (!code.includes('popup-closed') && !code.includes('cancelled-popup')) {
        setError(apiErrorMessage(e, 'No pudimos entrar con Google. Intenta con tu correo.'));
      }
    } finally {
      setGooglePending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    requestLink.mutate({ email: email.trim().toLowerCase(), turnstileToken }, {
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

              <TurnstileWidget onToken={setTurnstileToken} />

              <Button
                type="submit"
                className="w-full"
                disabled={
                  !email.trim() ||
                  requestLink.isPending ||
                  (isTurnstileEnabled() && !turnstileToken)
                }
              >
                {requestLink.isPending ? 'Enviando…' : 'Enviarme el link'}
                {!requestLink.isPending && <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />}
              </Button>
            </form>

            {isGoogleSignInConfigured() && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[var(--border)]" />
                  <span className="text-[12px] text-[var(--fg-muted)]">o</span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogle}
                  disabled={googlePending}
                >
                  {googlePending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
                      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
                      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
                      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
                    </svg>
                  )}
                  Continuar con Google
                </Button>
              </>
            )}
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
