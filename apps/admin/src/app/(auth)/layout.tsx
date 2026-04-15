import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 animate-mesh px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Turnly</h1>
          <p className="text-white/60 mt-1">Gestion de citas y servicios</p>
        </div>
        <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-elevated p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
