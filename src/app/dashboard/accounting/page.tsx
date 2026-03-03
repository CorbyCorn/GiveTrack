'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import Header from '@/components/layout/header';
import StatCard from '@/components/ui/stat-card';
import DataTable from '@/components/ui/data-table';
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { useDailyCosts, useCreditBalance } from '@/lib/hooks';
import { formatMoney, formatDate } from '@/lib/format';
import { TOTAL_CREDIT_GRANT } from '@/lib/constants';
import { exportDailyCostsCsv, exportMonthlySummaryCsv, downloadCsv } from '@/lib/csv-export';
import { generateMonthlyReport } from '@/lib/pdf-export';
import type { MonthlyBurnSummary } from '@/lib/types';

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function AccountingPage() {
  const { data: costs, isLoading: costsLoading } = useDailyCosts();
  const { data: credits, isLoading: creditsLoading } = useCreditBalance();
  const isLoading = costsLoading || creditsLoading;

  const totalSpent = useMemo(() => costs?.reduce((s, c) => s + c.totalCost, 0) ?? 0, [costs]);
  const remaining = credits?.remaining ?? TOTAL_CREDIT_GRANT - totalSpent;
  const utilization = TOTAL_CREDIT_GRANT > 0 ? (totalSpent / TOTAL_CREDIT_GRANT) * 100 : 0;

  // Monthly summaries
  const monthlySummaries = useMemo<MonthlyBurnSummary[]>(() => {
    if (!costs) return [];
    const monthMap: Record<string, { costs: number[]; breakdown: Record<string, number> }> = {};

    for (const day of costs) {
      const month = day.date.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { costs: [], breakdown: {} };
      monthMap[month].costs.push(day.totalCost);
      for (const b of day.breakdown) {
        monthMap[month].breakdown[b.model] = (monthMap[month].breakdown[b.model] || 0) + b.cost;
      }
    }

    let cumulative = 0;
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const totalCost = data.costs.reduce((s, c) => s + c, 0);
        cumulative += totalCost;
        const topEntry = Object.entries(data.breakdown).sort((a, b) => b[1] - a[1])[0];

        return {
          month,
          totalCost: Math.round(totalCost * 100) / 100,
          avgDailyCost: Math.round((totalCost / data.costs.length) * 100) / 100,
          daysActive: data.costs.length,
          topModel: topEntry?.[0] ?? 'N/A',
          topModelCost: Math.round((topEntry?.[1] ?? 0) * 100) / 100,
          cumulativeTotal: Math.round(cumulative * 100) / 100,
          remainingCredits: Math.round((TOTAL_CREDIT_GRANT - cumulative) * 100) / 100,
        };
      });
  }, [costs]);

  // Cumulative chart data
  const cumulativeData = useMemo(() => {
    if (!costs) return [];
    let cum = 0;
    return costs.map((c) => {
      cum += c.totalCost;
      return { date: c.date, cumulative: cum };
    });
  }, [costs]);

  function handleExportDailyCsv() {
    if (!costs) return;
    const csv = exportDailyCostsCsv(costs);
    downloadCsv(csv, `openai-daily-costs-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  }

  function handleExportMonthlyCsv() {
    const csv = exportMonthlySummaryCsv(monthlySummaries);
    downloadCsv(csv, `openai-monthly-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  }

  function handleExportPdf() {
    generateMonthlyReport(
      monthlySummaries,
      credits?.totalGranted ?? TOTAL_CREDIT_GRANT,
      totalSpent,
      remaining,
    );
  }

  return (
    <div className="animate-fade-in">
      <Header title="Accounting & Valuation" />

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Credit Grant Value"
                value={formatMoney(credits?.totalGranted ?? TOTAL_CREDIT_GRANT)}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                }
              />
              <StatCard
                label="Remaining Value"
                value={formatMoney(remaining)}
                color="green"
              />
              <StatCard
                label="Total Consumed"
                value={formatMoney(totalSpent)}
                color="red"
              />
              <StatCard
                label="Utilization"
                value={`${utilization.toFixed(2)}%`}
              />
            </>
          )}
        </div>

        {/* Export buttons */}
        <div className="card p-4 flex flex-wrap gap-3">
          <span className="text-sm text-navy-300 self-center mr-2">Export:</span>
          <button onClick={handleExportDailyCsv} disabled={isLoading} className="btn-secondary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Daily CSV
          </button>
          <button onClick={handleExportMonthlyCsv} disabled={isLoading} className="btn-secondary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Monthly CSV
          </button>
          <button onClick={handleExportPdf} disabled={isLoading} className="btn-primary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            PDF Report
          </button>
        </div>

        {/* Cumulative usage chart */}
        {isLoading ? (
          <ChartSkeleton height="h-80" />
        ) : (
          <div className="card-hover p-5">
            <h3 className="stat-label mb-4">Cumulative Usage vs. Credit Grant</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2C4F" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#717F9A', fontSize: 10 }}
                    tickFormatter={(d) => {
                      try { return format(parseISO(d), 'MMM d'); } catch { return d; }
                    }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#717F9A', fontSize: 10 }}
                    tickFormatter={fmtMoney}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E2C4F',
                      border: '1px solid #31466C',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#E8EBF0',
                    }}
                    formatter={(value: number) => [fmtMoney(value), 'Cumulative']}
                    labelFormatter={(d) => {
                      try { return format(parseISO(d as string), 'MMM d, yyyy'); } catch { return d as string; }
                    }}
                  />
                  <ReferenceLine
                    y={TOTAL_CREDIT_GRANT}
                    stroke="#EF4444"
                    strokeDasharray="8 4"
                    strokeWidth={2}
                    label={{ value: '$40M Grant', fill: '#EF4444', fontSize: 11, position: 'right' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#cumGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Monthly summary table */}
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <div>
            <h3 className="stat-label mb-3">Monthly Burn Summary</h3>
            <DataTable
              columns={[
                { key: 'month', label: 'Month', render: (r) => <span className="font-mono text-xs">{r.month}</span> },
                { key: 'totalCost', label: 'Total Cost', align: 'right', render: (r) => <span className="font-mono text-xs font-semibold">{formatMoney(r.totalCost)}</span> },
                { key: 'avgDailyCost', label: 'Avg Daily', align: 'right', render: (r) => <span className="font-mono text-xs">{formatMoney(r.avgDailyCost)}</span> },
                { key: 'daysActive', label: 'Days', align: 'center' },
                { key: 'topModel', label: 'Top Model', render: (r) => <span className="text-accent-blue text-xs">{r.topModel}</span> },
                { key: 'cumulativeTotal', label: 'Cumulative', align: 'right', render: (r) => <span className="font-mono text-xs">{formatMoney(r.cumulativeTotal)}</span> },
                { key: 'remainingCredits', label: 'Remaining', align: 'right', render: (r) => (
                  <span className={`font-mono text-xs font-semibold ${r.remainingCredits > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatMoney(r.remainingCredits)}
                  </span>
                )},
              ]}
              data={monthlySummaries}
              getRowKey={(r) => r.month}
              pageSize={12}
            />
          </div>
        )}
      </div>
    </div>
  );
}
