'use client';

import { Badge } from '@/presentation/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import type { ServiceLog } from '@/domain/entities/service-log';

type InvoiceStatus = NonNullable<ServiceLog['invoiceStatus']>;

const CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  pendiente:  { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  enviada:    { label: 'Enviada',    className: 'bg-blue-100 text-blue-800 border-blue-200' },
  autorizada: { label: 'Autorizada', className: 'bg-green-100 text-green-800 border-green-200' },
  rechazada:  { label: 'Rechazada',  className: 'bg-red-100 text-red-800 border-red-200' },
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus | null;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  if (!status) return null;
  const { label, className: statusClass } = CONFIG[status];
  return (
    <Badge variant="outline" className={cn(statusClass, className)}>
      {label}
    </Badge>
  );
}
