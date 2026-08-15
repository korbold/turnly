'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { LogOut, Trash2, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/dialog';
import { useMe } from '@/presentation/hooks/use-auth';
import { useDeleteAccount } from '@/presentation/hooks/use-client-portal';
import { authStorage } from '@/infrastructure/storage/auth-storage';
import { apiErrorMessage } from '@/shared/utils/api-error';

export default function ClientProfilePage() {
  const router = useRouter();
  const { data: me } = useMe();
  const deleteAccount = useDeleteAccount();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const name = me?.user?.name ?? '';
  const email = me?.user?.email ?? '';
  const initials = name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function handleLogout() {
    authStorage.clear();
    router.replace('/app/login');
  }

  function handleDelete() {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        toast.success('Solicitud enviada. Tu cuenta se eliminará en los próximos días.');
        setConfirmDelete(false);
        authStorage.clear();
        router.replace('/explorar');
      },
      onError: (e) => toast.error(apiErrorMessage(e, 'No se pudo procesar la solicitud')),
    });
  }

  return (
    <div className="space-y-5">
      <h1
        className="text-[24px] font-bold leading-tight text-[var(--fg-strong)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Perfil
      </h1>

      <section className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--ink-75)] text-[16px] font-semibold text-[var(--fg-strong)]">
          {initials || '?'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-[var(--fg-strong)]">
            {name || 'Sin nombre'}
          </p>
          <p className="truncate text-[13.5px] text-[var(--fg-secondary)]">{email}</p>
        </div>
      </section>

      <nav className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
        <Link
          href="/terms"
          className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5 text-[14px] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <FileText className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
          Términos y condiciones
        </Link>
        <Link
          href="/privacy"
          className="flex items-center gap-3 px-4 py-3.5 text-[14px] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <ShieldCheck className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
          Política de privacidad
        </Link>
      </nav>

      <Button variant="outline" className="w-full" onClick={handleLogout}>
        <LogOut className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Cerrar sesión
      </Button>

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-[var(--danger-700)]"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Eliminar mi cuenta
      </button>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar cuenta</DialogTitle>
            <DialogDescription>
              Se borrarán tus datos y tu historial de reservas. Si entras de nuevo antes de que se
              complete, la eliminación se cancela.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteAccount.isPending}
              className="bg-[var(--danger-700)] hover:bg-[var(--danger-700)]/90"
            >
              Eliminar mi cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
