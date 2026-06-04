'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useService } from '@/presentation/hooks/use-services';
import { VariantEditor } from '@/presentation/components/features/services/variant-editor';

export default function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: service, isLoading } = useService(id);

  if (isLoading || !service) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/services"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-default)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink-900)]">
            {service.name}
          </h1>
          {service.description && (
            <p className="text-[13px] text-[var(--fg-secondary)]">{service.description}</p>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <VariantEditor serviceId={service.id} />
      </section>
    </div>
  );
}
