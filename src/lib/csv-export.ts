import type { DailyCostRecord, MonthlyBurnSummary } from './types';

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportDailyCostsCsv(records: DailyCostRecord[]): string {
  const headers = ['Date', 'Total Cost ($)', 'Models'];
  const rows = records.map((r) => [
    r.date,
    r.totalCost.toFixed(2),
    r.breakdown.map((b) => `${b.model}: $${b.cost.toFixed(2)}`).join('; '),
  ]);

  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((r) => r.map(escapeCsv).join(',')),
  ].join('\n');
}

export function exportMonthlySummaryCsv(summaries: MonthlyBurnSummary[]): string {
  const headers = [
    'Month',
    'Total Cost ($)',
    'Avg Daily Cost ($)',
    'Days Active',
    'Top Model',
    'Top Model Cost ($)',
    'Cumulative Total ($)',
    'Remaining Credits ($)',
  ];

  const rows = summaries.map((s) => [
    s.month,
    s.totalCost.toFixed(2),
    s.avgDailyCost.toFixed(2),
    s.daysActive,
    s.topModel,
    s.topModelCost.toFixed(2),
    s.cumulativeTotal.toFixed(2),
    s.remainingCredits.toFixed(2),
  ]);

  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((r) => r.map(escapeCsv).join(',')),
  ].join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
