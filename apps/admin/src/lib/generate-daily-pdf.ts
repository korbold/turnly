import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DailyReport } from '@/lib/api/reports';
import type { ServiceLog } from '@/types/service-log';
import type { Reservation } from '@/types/reservation';

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
};

export function generateDailyPDF(
  date: string,
  report: DailyReport,
  logs: ServiceLog[],
  reservations: Reservation[],
) {
  const doc = new jsPDF();
  const formattedDate = format(new Date(date + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es });

  // Title
  doc.setFontSize(18);
  doc.text('Reporte Diario', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(formattedDate, 14, 28);

  // Summary cards
  doc.setTextColor(0);
  doc.setFontSize(10);
  let y = 38;

  doc.setFontSize(12);
  doc.text('Resumen', 14, y);
  y += 8;

  doc.setFontSize(10);
  const summaryData = [
    ['Total servicios', String(report.washes.total)],
    ['Completados', String(report.washes.completed)],
    ['En progreso', String(report.washes.in_progress)],
    ['Ingresos totales', `$${report.washes.revenue?.toFixed(2) ?? '0.00'}`],
    ['Reservaciones', String(report.reservations.total)],
    ['Pendientes', String(report.reservations.pending)],
    ['Canceladas', String(report.reservations.cancelled)],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Valor']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as Record<string, number>).lastAutoTable?.finalY ?? y + 50;
  y += 10;

  // Detail table
  doc.setFontSize(12);
  doc.text('Detalle del día', 14, y);
  y += 6;

  const rows: string[][] = [];

  for (const r of reservations) {
    rows.push([
      format(new Date(r.scheduled_at), 'HH:mm'),
      r.client?.name ?? '—',
      r.service?.name ?? '—',
      '—',
      r.service?.price ? `$${Number(r.service.price).toFixed(2)}` : '—',
      '—',
      statusLabels[r.status] ?? r.status,
      'Reservación',
    ]);
  }

  for (const log of logs) {
    rows.push([
      format(new Date(log.started_at), 'HH:mm'),
      log.client_resource?.plate ?? '—',
      log.service?.name ?? '—',
      log.attendant?.name ?? '—',
      `$${Number(log.price_charged).toFixed(2)}`,
      paymentLabels[log.payment_method] ?? log.payment_method,
      statusLabels[log.status] ?? log.status,
      'Servicio',
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Hora', 'Cliente', 'Servicio', 'Empleado', 'Precio', 'Pago', 'Estado', 'Tipo']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 8 },
    columnStyles: { 4: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as Record<string, number>).lastAutoTable?.finalY ?? y + 50;
  y += 10;

  // Payment method breakdown
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.text('Desglose por método de pago', 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Método', 'Total']],
    body: [
      ['Efectivo', `$${report.washes.by_payment_method?.cash?.toFixed(2) ?? '0.00'}`],
      ['Tarjeta', `$${report.washes.by_payment_method?.card?.toFixed(2) ?? '0.00'}`],
      ['Transferencia', `$${report.washes.by_payment_method?.transfer?.toFixed(2) ?? '0.00'}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generado el ${format(new Date(), "d/MM/yyyy HH:mm")} — Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10,
    );
  }

  doc.save(`reporte-diario-${date}.pdf`);
}
