'use client';

import { useState, useMemo, Suspense } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useTeam } from '@/presentation/hooks/use-team';
import { StaffCard } from '@/presentation/components/features/team/staff-card';
import { InviteModal } from '@/presentation/components/features/team/invite-modal';

function TeamContent() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useTeam({ excludeRole: 'client' });
  const members = data?.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.name, m.email, m.username, m.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  }, [members, search]);

  const hasSearch = search.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, usuario…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setInviteOpen(true)} className="sm:self-auto">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Agregar miembro
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[80px] w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <Users className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
          </div>
          <p className="text-[15px] font-semibold text-[var(--fg-strong)]">
            {hasSearch ? 'Sin coincidencias' : 'Aún no tienes equipo'}
          </p>
          <p className="mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">
            {hasSearch
              ? 'Prueba con otro nombre o limpia la búsqueda.'
              : 'Invita a tu equipo para que cada quien atienda y registre desde su cuenta.'}
          </p>
          {!hasSearch && (
            <Button onClick={() => setInviteOpen(true)} className="mt-5">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Agregar primer miembro
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <StaffCard key={user.id} user={user} />
          ))}
        </div>
      )}

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full sm:max-w-md" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[80px] w-full rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <TeamContent />
    </Suspense>
  );
}
