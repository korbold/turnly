'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Star, Car, User } from 'lucide-react';
import { Card, CardContent } from '@/presentation/components/ui/card';
import type { ClientResource } from '@/domain/entities/client-resource';

interface ClientCardProps {
  client: ClientResource;
}

export function ClientCard({ client }: ClientCardProps) {
  const router = useRouter();
  const hasPlate = !!client.plate;
  const clientName = client.client?.name ?? null;
  const displayName = hasPlate ? client.plate! : clientName ?? 'Sin identificar';
  const vehicleInfo = [client.brand, client.model, client.color].filter(Boolean).join(' - ');
  const subtitle = hasPlate
    ? clientName ?? vehicleInfo
    : client.client?.email ?? '';

  // Derive visits from data if available
  const visits = (client.data as Record<string, unknown> | null)?.totalVisits;
  const lastVisit = (client.data as Record<string, unknown> | null)?.lastVisit;
  const isFrequent = typeof visits === 'number' && visits > 10;

  return (
    <motion.div whileHover={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <Card
        className="cursor-pointer transition-shadow"
        onClick={() => router.push(`/clients/${client.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50">
              {hasPlate ? (
                <Car className="h-5 w-5 text-indigo-600" />
              ) : (
                <User className="h-5 w-5 text-indigo-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                {isFrequent && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
              </div>
              {clientName && hasPlate && (
                <p className="truncate text-xs font-medium text-indigo-600">{clientName}</p>
              )}
              {vehicleInfo && hasPlate && (
                <p className="truncate text-xs text-muted-foreground">{vehicleInfo}</p>
              )}
              {!hasPlate && subtitle && (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            {typeof visits === 'number' && (
              <span>{String(visits)} visitas</span>
            )}
            {typeof lastVisit === 'string' && lastVisit && (
              <span>
                Hace {formatDistanceToNow(new Date(lastVisit), { locale: es })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
