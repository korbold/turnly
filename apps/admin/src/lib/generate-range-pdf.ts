import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { RangeReport } from '@/lib/api/reports';

const dayNames: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };

export function generateRangePDF(report: RangeReport) {
  const doc = new jsPDF();
  const fromLabel = format(new Date(report.from + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es });
  const toLabel = format(new Date(report.to + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es });

  doc.setFontSize(18);
  doc.text('Reporte por Rango', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`${fromLabel}  —  ${toLabel}`, 14, 28);

  doc.setTextColor(0);
  let y = 38;

  // Summary
  doc.setFontSize(12);
  doc.text('Resumen', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Valor']],
    body: [
      ['Total atenciones', String(report.total_services)],
      ['Servicios directos', String(report.services_count)],
      ['Reservaciones atendidas', String(report.reservations_count)],
      ['Reservaciones totales', String(report.reservations_total)],
      ['Canceladas', String(report.reservations_cancelled)],
      ['Ingresos totales', `$${report.total_revenue.toFixed(2)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as Record<string, number>).lastAutoTable?.finalY ?? y + 50;
  y += 10;

  // Daily breakdown
  doc.setFontSize(12);
  doc.text('Desglose por día', 14, y);
  y += 6;

  const dailyRows = report.daily.map((d) => {
    const date = new Date(d.date + 'T12:00:00');
    const dayName = dayNames[date.getDay()] ?? '';
    return [
      `${dayName} ${format(date, 'dd/MM/yyyy')}`,
      String(d.services),
      String(d.reservations),
      `$${d.revenue.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Día', 'Servicios', 'Reservaciones', 'Ingresos']],
    body: dailyRows,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as Record<string, number>).lastAutoTable?.finalY ?? y + 50;
  y += 10;

  // Payment breakdown
  if (y > 250) { doc.addPage(); y = 20; }

  doc.setFontSize(12);
  doc.text('Desglose por método de pago', 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Método', 'Total']],
    body: [
      ['Efectivo', `$${report.by_payment_method.cash.toFixed(2)}`],
      ['Tarjeta', `$${report.by_payment_method.card.toFixed(2)}`],
      ['Transferencia', `$${report.by_payment_method.transfer.toFixed(2)}`],
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
      `Generado el ${format(new Date(), 'd/MM/yyyy HH:mm')} — Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10,
    );
  }

  doc.save(`reporte-${report.from}-a-${report.to}.pdf`);
}
