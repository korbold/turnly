import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Turnly</h1>
          <p className="text-slate-500 mt-1">Configura tu negocio</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card border border-slate-200/50 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
