'use client';

import { useRouter } from 'next/navigation';
import { CalendarPlus, UserPlus, ShieldBan } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { motion } from 'framer-motion';

const ACTIONS = [
  {
    label: 'Nueva Reserva',
    icon: CalendarPlus,
    href: '/reservations?create=true',
    color: 'text-[var(--color-primary)]',
    bg: 'bg-[var(--color-primary-muted)]',
  },
  {
    label: 'Sin cita',
    icon: UserPlus,
    href: '/service-log',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    label: 'Bloquear Horario',
    icon: ShieldBan,
    href: '/settings',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
] as const;

export function QuickActions() {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Acciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ACTIONS.map((action) => (
          <motion.button
            key={action.label}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-shadow hover:shadow-sm"
            onClick={() => router.push(action.href)}
          >
            <div className={`rounded-lg ${action.bg} p-2.5`}>
              <action.icon className={`h-5 w-5 ${action.color}`} />
            </div>
            <span className="text-sm font-medium">{action.label}</span>
          </motion.button>
        ))}
      </CardContent>
    </Card>
  );
}
