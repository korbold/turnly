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
          <img
            src="/turnly-wordmark.svg"
            alt="Turnly"
            width={160}
            height={56}
            className="h-14 w-auto"
          />
        </div>

        {children}
      </div>
    </div>
  );
}
