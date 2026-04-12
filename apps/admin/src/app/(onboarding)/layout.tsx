import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Turnly</h1>
          <p className="text-gray-500 mt-1">Configura tu negocio</p>
        </div>
        {children}
      </div>
    </div>
  );
}
