'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { login } from '@/lib/api/auth';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setLoading(true);
    try {
      const result = await login(data.email, data.password);
      if (result.data.user.is_super_admin) {
        router.push('/super-admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const apiError = err as { message?: string };
      setError(apiError?.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="bg-red-500/20 text-white text-sm p-3 rounded-lg border border-red-400/30">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-white/80">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="tu@email.com"
          className="w-full h-11 bg-white/5 border border-white/10 rounded-lg px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-red-300">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-white/80">
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          className="w-full h-11 bg-white/5 border border-white/10 rounded-lg px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-red-300">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-white text-indigo-600 font-semibold text-sm rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <p className="text-sm text-white/60 text-center">
        No tienes cuenta?{' '}
        <Link href="/register" className="text-white hover:underline font-medium">
          Registrate
        </Link>
      </p>
    </form>
  );
}
