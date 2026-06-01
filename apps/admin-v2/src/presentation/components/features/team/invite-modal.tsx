'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Copy, RefreshCw, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { useInviteUser } from '@/presentation/hooks/use-team';
import type { UserRole } from '@/domain/entities/user';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'tenant_admin', label: 'Administrador' },
  { value: 'cashier', label: 'Cajero' },
  { value: 'washer', label: 'Lavador' },
];

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

function generatePassword(length = 8): string {
  // Avoid ambiguous chars (0/O, 1/l/I) so admins can dictate the password
  // verbally without mistakes.
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : undefined;
  if (cryptoObj) {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  } else {
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function slugifyUsername(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 60);
}

interface CreatedCreds {
  name: string;
  username: string;
  password: string;
  role: UserRole;
}

export function InviteModal({ open, onClose }: InviteModalProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('washer');
  const [created, setCreated] = useState<CreatedCreds | null>(null);
  const [copied, setCopied] = useState(false);
  const inviteMutation = useInviteUser();

  function resetForm() {
    setName('');
    setUsername('');
    setUsernameTouched(false);
    setPassword(generatePassword());
    setShowPassword(false);
    setRole('washer');
    setCreated(null);
    setCopied(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!usernameTouched) {
      const auto = slugifyUsername(value.split(' ')[0] ?? '');
      setUsername(auto);
    }
  }

  function handleSubmit() {
    if (!name.trim() || !username.trim() || !password.trim()) return;
    inviteMutation.mutate(
      {
        name: name.trim(),
        username: slugifyUsername(username),
        password,
        role,
      },
      {
        onSuccess: () => {
          toast.success('Miembro creado');
          setCreated({ name: name.trim(), username: slugifyUsername(username), password, role });
        },
        onError: (err: unknown) => {
          const e = err as { message?: string; response?: { data?: { errors?: Record<string, string[]> } } };
          const errors = e?.response?.data?.errors;
          if (errors) {
            const first = Object.values(errors)[0]?.[0];
            toast.error(first ?? 'Error al crear miembro');
            return;
          }
          toast.error(e?.message ?? 'Error al crear miembro');
        },
      }
    );
  }

  async function copyCreds() {
    if (!created) return;
    const text = `Turnly\nUsuario: ${created.username}\nContraseña: ${created.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Credenciales generadas</DialogTitle>
              <DialogDescription>
                Guarda y entrega estas credenciales a {created.name}. No volverán a mostrarse.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Usuario</div>
                <div className="font-mono text-base">{created.username}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Contraseña</div>
                <div className="font-mono text-base">{created.password}</div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={copyCreds}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
              <Button onClick={handleClose}>Listo</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Agregar miembro</DialogTitle>
              <DialogDescription>
                Crea un usuario y contraseña para tu equipo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="mb-1.5">Nombre</Label>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  autoFocus
                />
              </div>

              <div>
                <Label className="mb-1.5">Usuario</Label>
                <Input
                  value={username}
                  onChange={(e) => {
                    setUsernameTouched(true);
                    setUsername(slugifyUsername(e.target.value));
                  }}
                  placeholder="juan"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Solo letras, números, punto, guion o guion bajo.
                </p>
              </div>

              <div>
                <Label className="mb-1.5">Contraseña</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPassword(generatePassword())}
                    title="Generar nueva"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="mb-1.5">Rol</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !name.trim() || !username.trim() || !password.trim() || inviteMutation.isPending
                }
              >
                Crear miembro
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
