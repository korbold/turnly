import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function generateMonthlyPDF(
  month: string,
  report: Record<string, unknown>,
) {
  const doc = new jsPDF();

  const monthDate = new Date(month + '-15');
  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es });

  doc.setFontSize(18);
  doc.text('Reporte Mensual', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), 14, 28);

  // Summary
  doc.setTextColor(0);
  let y = 38;
  doc.setFontSize(12);
  doc.text('Resumen', 14, y);
  y += 8;

  const totalWashes = typeof report?.total_washes === 'number' ? report.total_washes : 0;
  const totalRevenue = typeof report?.total_revenue === 'number' ? report.total_revenue : 0;
  const avgDaily = typeof report?.average_daily_washes === 'number' ? report.average_daily_washes : 0;

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Valor']],
    body: [
      ['Total servicios', String(totalWashes)],
      ['Ingresos totales', `$${totalRevenue.toFixed(2)}`],
      ['Promedio diario', String(avgDaily)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as Record<string, number>).lastAutoTable?.finalY ?? y + 30;
  y += 10;

  // Payment breakdown
  const byPayment = report?.by_payment_method as Record<string, number> | undefined;
  if (byPayment) {
    doc.setFontSize(12);
    doc.text('Desglose por método de pago', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Método', 'Total']],
      body: [
        ['Efectivo', `$${(byPayment.cash ?? 0).toFixed(2)}`],
        ['Tarjeta', `$${(byPayment.card ?? 0).toFixed(2)}`],
        ['Transferencia', `$${(byPayment.transfer ?? 0).toFixed(2)}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
  }

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

  doc.save(`reporte-mensual-${month}.pdf`);
}
