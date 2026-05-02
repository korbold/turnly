'use client';

import { useState, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useTeam } from '@/presentation/hooks/use-team';
import { StaffCard } from '@/presentation/components/features/team/staff-card';
import { InviteModal } from '@/presentation/components/features/team/invite-modal';

function TeamContent() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data, isLoading } = useTeam({ excludeRole: 'client' });
  const members = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Invitar
        </Button>
      </div>

      {/* Staff grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-16 text-center">
          <p className="text-sm text-muted-foreground">No hay miembros del equipo</p>
          <Button variant="link" onClick={() => setInviteOpen(true)}>
            Invitar primer miembro
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((user) => (
            <StaffCard key={user.id} user={user} />
          ))}
        </div>
      )}

      {/* Invite modal */}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <TeamContent />
    </Suspense>
  );
}
