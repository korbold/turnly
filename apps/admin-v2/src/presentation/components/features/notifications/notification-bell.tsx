'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/presentation/components/ui/dialog';
import { useUnreadCount, useRegisterPushToken } from '@/presentation/hooks/use-notifications';
import { NotificationDropdown } from './notification-dropdown';

export function NotificationBell() {
  const { needsPrompt, enableNotifications } = useRegisterPushToken();
  const unreadCount = useUnreadCount();
  const [open, setOpen] = useState(false);

  async function handleEnable() {
    await enableNotifications();
    setOpen(false);
  }

  return (
    <>
      <Dialog open={needsPrompt && open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🔔</span> Activar notificaciones
            </DialogTitle>
            <DialogDescription className="pt-1">
              Recibe alertas en tiempo real cuando lleguen nuevas reservas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-zinc-600">
              iOS requiere que autorices las notificaciones manualmente. Toca el botón de abajo y luego <strong>"Permitir"</strong> cuando aparezca el diálogo del sistema.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Ahora no
              </Button>
              <Button className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]" onClick={handleEnable}>
                Activar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-zinc-500 hover:text-zinc-700"
            onClick={() => { if (needsPrompt) setOpen(true); }}
          >
            <Bell className="h-5 w-5" />
            {needsPrompt && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-amber-400" />
            )}
            {!needsPrompt && unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <span className="sr-only">Notificaciones</span>
          </Button>
        </PopoverTrigger>
        {!needsPrompt && (
          <PopoverContent align="end" className="w-96 p-0">
            <NotificationDropdown />
          </PopoverContent>
        )}
      </Popover>
    </>
  );
}
