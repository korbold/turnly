import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
      <footer className="py-8 text-center text-sm text-gray-400">
        Powered by <span className="font-medium text-gray-600">Turnly</span>
      </footer>
    </div>
  );
}
