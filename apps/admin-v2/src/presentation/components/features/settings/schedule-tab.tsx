'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  useAvailabilitySlots,
  useUpdateSlots,
  useBlocks,
  useCreateBlock,
  useDeleteBlock,
} from '@/presentation/hooks/use-availability';
import type { AvailabilitySlot } from '@/domain/entities/availability';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

interface SlotRow {
  dayOfWeek: number;
  ranges: Array<{ id: string; startTime: string; endTime: string; isActive: boolean }>;
}

export function ScheduleTab() {
  const { data: slotsData, isLoading: slotsLoading } = useAvailabilitySlots();
  const updateSlots = useUpdateSlots();
  const { data: blocksData, isLoading: blocksLoading } = useBlocks();
  const createBlock = useCreateBlock();
  const deleteBlock = useDeleteBlock();

  const [rows, setRows] = useState<SlotRow[]>([]);
  const [blockDate, setBlockDate] = useState('');
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    if (slotsData) {
      const slots = Array.isArray(slotsData) ? slotsData : (slotsData as { data?: AvailabilitySlot[] }).data ?? [];
      const grouped: Record<number, SlotRow['ranges']> = {};
      for (let d = 0; d < 7; d++) grouped[d] = [];
      slots.forEach((s: AvailabilitySlot) => {
        grouped[s.dayOfWeek]?.push({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        });
      });
      setRows(
        Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          ranges: grouped[i].length > 0 ? grouped[i] : [{ id: `new-${i}`, startTime: '08:00', endTime: '18:00', isActive: false }],
        }))
      );
    }
  }, [slotsData]);

  function toggleDay(day: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.dayOfWeek === day
          ? { ...r, ranges: r.ranges.map((rng) => ({ ...rng, isActive: !rng.isActive })) }
          : r
      )
    );
  }

  function updateRange(day: number, idx: number, field: 'startTime' | 'endTime', value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.dayOfWeek === day
          ? { ...r, ranges: r.ranges.map((rng, i) => (i === idx ? { ...rng, [field]: value } : rng)) }
          : r
      )
    );
  }

  function addRange(day: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.dayOfWeek === day
          ? {
              ...r,
              ranges: [...r.ranges, { id: `new-${day}-${r.ranges.length}`, startTime: '08:00', endTime: '18:00', isActive: true }],
            }
          : r
      )
    );
  }

  function removeRange(day: number, idx: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.dayOfWeek === day
          ? { ...r, ranges: r.ranges.filter((_, i) => i !== idx) }
          : r
      )
    );
  }

  async function handleSaveSchedule() {
    const slots: AvailabilitySlot[] = rows.flatMap((r) =>
      r.ranges.map((rng) => ({
        id: rng.id,
        dayOfWeek: r.dayOfWeek,
        startTime: rng.startTime,
        endTime: rng.endTime,
        isActive: rng.isActive,
        maxConcurrent: 1,
      }))
    );
    try {
      await updateSlots.mutateAsync(slots);
      toast.success('Horario guardado');
    } catch {
      toast.error('Error al guardar horario');
    }
  }

  async function handleCreateBlock() {
    if (!blockDate) return;
    try {
      await createBlock.mutateAsync({
        date: blockDate,
        startTime: undefined,
        endTime: undefined,
        reason: blockReason || undefined,
      });
      setBlockDate('');
      setBlockReason('');
      toast.success('Bloqueo creado');
    } catch {
      toast.error('Error al crear bloqueo');
    }
  }

  const isLoading = slotsLoading || blocksLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const blocks = Array.isArray(blocksData) ? blocksData : (blocksData as { data?: typeof blocksData } | undefined)?.data ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Weekly schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Horario Semanal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.dayOfWeek} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleDay(row.dayOfWeek)}
                    className={`h-5 w-9 rounded-full transition-colors ${
                      row.ranges.some((r) => r.isActive) ? 'bg-indigo-600' : 'bg-zinc-300'
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full bg-white transition-transform ${
                        row.ranges.some((r) => r.isActive) ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium">{DAY_NAMES[row.dayOfWeek]}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => addRange(row.dayOfWeek)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {row.ranges.map((rng, idx) => (
                <div key={rng.id} className="ml-12 flex items-center gap-2">
                  <Input
                    type="time"
                    value={rng.startTime}
                    onChange={(e) => updateRange(row.dayOfWeek, idx, 'startTime', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <Input
                    type="time"
                    value={rng.endTime}
                    onChange={(e) => updateRange(row.dayOfWeek, idx, 'endTime', e.target.value)}
                    className="w-28"
                  />
                  {row.ranges.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeRange(row.dayOfWeek, idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ))}
          <Button onClick={handleSaveSchedule} disabled={updateSlots.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            {updateSlots.isPending ? 'Guardando...' : 'Guardar Horario'}
          </Button>
        </CardContent>
      </Card>

      {/* Availability blocks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Bloqueos de Disponibilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Razon (opcional)</Label>
              <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Ej: Dia festivo" />
            </div>
            <Button size="sm" onClick={handleCreateBlock} disabled={createBlock.isPending || !blockDate}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Bloquear
            </Button>
          </div>

          {Array.isArray(blocks) && blocks.length > 0 && (
            <div className="space-y-2">
              {blocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">
                      {format(parseISO(block.date), 'dd MMM yyyy', { locale: es })}
                    </span>
                    {block.reason && (
                      <span className="ml-2 text-muted-foreground">— {block.reason}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteBlock.mutate(block.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
