import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export function generateWeeklyPDF(
  week: string,
  report: Record<string, unknown>,
) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Reporte Semanal', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Semana: ${week}`, 14, 28);

  // Summary
  doc.setTextColor(0);
  let y = 38;
  doc.setFontSize(12);
  doc.text('Resumen', 14, y);
  y += 8;

  const totalWashes = typeof report?.total_washes === 'number' ? report.total_washes : 0;
  const totalRevenue = typeof report?.total_revenue === 'number' ? report.total_revenue : 0;

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Valor']],
    body: [
      ['Total servicios', String(totalWashes)],
      ['Ingresos totales', `$${totalRevenue.toFixed(2)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as Record<string, number>).lastAutoTable?.finalY ?? y + 30;
  y += 10;

  // Daily breakdown
  const daily = report?.daily as Record<string, { washes: number; revenue: number }> | undefined;
  if (daily) {
    doc.setFontSize(12);
    doc.text('Desglose por día', 14, y);
    y += 6;

    const dayNames: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
    const rows = Object.entries(daily).map(([dateStr, data]) => {
      const d = new Date(dateStr + 'T12:00:00');
      const dayName = dayNames[d.getDay()] ?? '';
      return [
        `${dayName} ${format(d, 'dd/MM')}`,
        String(data.washes),
        `$${data.revenue.toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Día', 'Servicios', 'Ingresos']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
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

  doc.save(`reporte-semanal-${week}.pdf`);
}
