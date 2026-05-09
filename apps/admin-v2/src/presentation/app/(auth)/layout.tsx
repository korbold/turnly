'use client';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg,#FAFAFB)] px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex justify-center">
          <img
            src="/turnly-wordmark.svg"
            alt="Turnly"
            width={140}
            height={48}
            className="h-11 w-auto"
          />
        </div>

        {children}

        <p className="mt-6 text-center text-[12px] text-[var(--fg-muted)]">
          Tu mostrador, en cualquier dispositivo.
        </p>
      </div>
    </div>
  );
}
