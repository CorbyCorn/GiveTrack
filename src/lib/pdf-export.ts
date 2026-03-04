import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MonthlyBurnSummary } from './types';

export function generateMonthlyReport(
  summaries: MonthlyBurnSummary[],
  totalGranted: number,
  totalUsed: number,
  remaining: number,
): void {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(11, 17, 33);
  doc.text('CreditLedger — API Credit Report', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 30);

  // Summary box
  doc.setFontSize(12);
  doc.setTextColor(11, 17, 33);
  doc.text('Credit Grant Summary', 14, 44);

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const summaryY = 52;
  doc.text(`Total Grant: $${totalGranted.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14, summaryY);
  doc.text(`Total Used: $${totalUsed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14, summaryY + 7);
  doc.text(`Remaining: $${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14, summaryY + 14);
  doc.text(`Utilization: ${((totalUsed / totalGranted) * 100).toFixed(2)}%`, 14, summaryY + 21);

  // Monthly table
  doc.setFontSize(12);
  doc.setTextColor(11, 17, 33);
  doc.text('Monthly Burn Summary', 14, summaryY + 36);

  autoTable(doc, {
    startY: summaryY + 40,
    head: [['Month', 'Total Cost', 'Avg Daily', 'Days', 'Top Model', 'Cumulative', 'Remaining']],
    body: summaries.map((s) => [
      s.month,
      `$${s.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `$${s.avgDailyCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      s.daysActive.toString(),
      s.topModel,
      `$${s.cumulativeTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `$${s.remainingCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [11, 17, 33], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 242, 245] },
    margin: { left: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`CreditLedger — Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 10);
  }

  doc.save(`creditledger-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
