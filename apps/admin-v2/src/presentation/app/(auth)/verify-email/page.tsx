'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/presentation/components/ui/card';
import {
  useVerifyEmail,
  useResendVerification,
} from '@/presentation/hooks/use-auth';
import { authStorage } from '@/infrastructure/storage/auth-storage';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailContent() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingVerifyEmail') ?? '';
    setEmail(stored);
    setLoaded(true);
  }, []);

  const verify = useVerifyEmail();
  const resend = useResendVerification();

  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: CODE_LENGTH }, () => ''),
  );
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  if (!loaded) {
    return (
      <Card>
        <CardContent className="py-10">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-400" />
        </CardContent>
      </Card>
    );
  }

  if (!email) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Verificación requerida</CardTitle>
          <CardDescription>Falta el email a verificar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className="block text-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Volver al inicio de sesión
          </Link>
        </CardContent>
      </Card>
    );
  }

  function setDigit(idx: number, value: string) {
    const sanitized = value.replace(/\D/g, '');
    if (sanitized.length > 1) {
      // Paste of multiple digits — fill from current index forward.
      const chars = sanitized.slice(0, CODE_LENGTH - idx).split('');
      setDigits((prev) => {
        const next = [...prev];
        chars.forEach((c, i) => {
          next[idx + i] = c;
        });
        return next;
      });
      const lastIdx = Math.min(idx + chars.length, CODE_LENGTH - 1);
      inputs.current[lastIdx]?.focus();
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = sanitized;
      return next;
    });
    if (sanitized && idx < CODE_LENGTH - 1) {
      inputs.current[idx + 1]?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  function submit() {
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) {
      setError('Código incompleto');
      return;
    }
    setError(null);
    verify.mutate(
      { email, code },
      {
        onSuccess: () => {
          sessionStorage.removeItem('pendingVerifyEmail');
          const isSuperAdmin = authStorage.getIsSuperAdmin();
          router.push(isSuperAdmin ? '/super-admin' : '/dashboard');
        },
        onError: (err: Error) => {
          setError(err.message || 'Código inválido');
          setDigits(Array.from({ length: CODE_LENGTH }, () => ''));
          inputs.current[0]?.focus();
        },
      },
    );
  }

  function handleResend() {
    if (cooldown > 0) return;
    resend.mutate(email, {
      onSuccess: () => {
        toast.success('Código reenviado a ' + email);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'No se pudo reenviar');
      },
    });
  }

  const allFilled = digits.every((d) => d.length === 1);

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
          <MailCheck className="h-6 w-6 text-indigo-600" />
        </div>
        <CardTitle className="text-xl">Verifica tu email</CardTitle>
        <CardDescription>
          Te enviamos un código de 6 dígitos a{' '}
          <span className="font-medium text-zinc-700">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                id={`otp-${i}`}
                name={`otp-${i}`}
                aria-label={`Dígito ${i + 1} del código`}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={CODE_LENGTH}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => handleKey(e, i)}
                onFocus={(e) => e.currentTarget.select()}
                className="h-12 w-10 rounded-md border border-input bg-background text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ))}
          </div>

          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={!allFilled || verify.isPending}
            onClick={submit}
          >
            {verify.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...
              </>
            ) : (
              'Verificar'
            )}
          </Button>

          <div className="text-center text-sm text-zinc-500">
            ¿No llegó?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resend.isPending}
              className="font-medium text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              {cooldown > 0 ? `Reenviar (${cooldown}s)` : 'Reenviar código'}
            </button>
          </div>

          <p className="text-center text-xs text-zinc-400">
            <Link href="/login" className="hover:text-zinc-600">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-10">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-400" />
          </CardContent>
        </Card>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
