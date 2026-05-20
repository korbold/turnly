'use client';

// Replacement for: apps/admin-v2/src/presentation/app/(auth)/layout.tsx
// Removes the indigo gradient background and brings the wordmark in line
// with the Turnly Design System (Coral brand, condensed Roboto display).

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-extrabold text-white"
              style={{ backgroundColor: 'var(--color-primary)', fontStretch: '90%' }}
            >
              T
            </div>
            <span
              className="text-2xl font-extrabold text-[var(--color-text-primary)]"
              style={{ fontStretch: '90%', letterSpacing: '-0.02em' }}
            >
              Turnly
            </span>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
