'use client';

import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';
import Header from '@/components/layout/header';
import StatCard from '@/components/ui/stat-card';
import CreditGauge from '@/components/ui/credit-gauge';
import TopModelsChart from '@/components/charts/top-models-chart';
import DailyCostChart from '@/components/charts/daily-cost-chart';
import DataTable from '@/components/ui/data-table';
import { CardSkeleton, GaugeSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { useUsageSummary, useCreditBalance, useDailyCosts } from '@/lib/hooks';
import { formatMoney, formatDate } from '@/lib/format';
import { TOTAL_CREDIT_GRANT } from '@/lib/constants';
import { exportDailyCostsCsv, exportMonthlySummaryCsv, downloadCsv } from '@/lib/csv-export';
import { generateMonthlyReport } from '@/lib/pdf-export';
import type { MonthlyBurnSummary } from '@/lib/types';

interface AmortizationRow {
  month: string;
  openingBalance: number;
  periodExpense: number;
  closingBalance: number;
}

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useUsageSummary();
  const { data: credits, isLoading: creditsLoading } = useCreditBalance();
  const { data: costs, isLoading: costsLoading } = useDailyCosts();

  const isLoading = summaryLoading || creditsLoading || costsLoading;

  const totalSpent = summary?.totalSpent ?? 0;
  const remaining = credits?.remaining ?? TOTAL_CREDIT_GRANT;
  const dailyAvg = summary?.dailyAvgBurn ?? 0;
  const weeklyAvg = summary?.weeklyAvgBurn ?? 0;
  const monthlyAvg = summary?.monthlyAvgBurn ?? 0;
  const exhaustionDate = summary?.estimatedExhaustionDate;
  const sparkline = summary?.dailyTrend?.slice(-14).map((d) => d.cost) ?? [];
  const utilization = TOTAL_CREDIT_GRANT > 0 ? (totalSpent / TOTAL_CREDIT_GRANT) * 100 : 0;

  // Monthly summaries for amortization schedule
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

  // Amortization schedule rows (Opening → Expense → Closing)
  const amortizationRows = useMemo<AmortizationRow[]>(() => {
    if (monthlySummaries.length === 0) return [];
    return monthlySummaries.map((s, i) => ({
      month: s.month,
      openingBalance: i === 0 ? TOTAL_CREDIT_GRANT : monthlySummaries[i - 1].remainingCredits,
      periodExpense: s.totalCost,
      closingBalance: s.remainingCredits,
    }));
  }, [monthlySummaries]);

  // Current month snapshot
  const now = new Date();
  const currentMonthKey = format(now, 'yyyy-MM');
  const currentMonthSummary = monthlySummaries.find((s) => s.month === currentMonthKey);
  const prevMonthKey = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'yyyy-MM');
  const prevMonthSummary = monthlySummaries.find((s) => s.month === prevMonthKey);

  const currentMonthExpense = currentMonthSummary?.totalCost ?? 0;
  const prevMonthExpense = prevMonthSummary?.totalCost ?? 0;
  const monthChange = currentMonthExpense - prevMonthExpense;
  const monthChangePct = prevMonthExpense > 0 ? (monthChange / prevMonthExpense) * 100 : 0;

  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = now.getDate();
  const projectedMonthExpense = dayOfMonth > 0 && currentMonthSummary
    ? (currentMonthExpense / (currentMonthSummary.daysActive || 1)) * daysInMonth
    : 0;

  // Export handlers
  function handleExportDailyCsv() {
    if (!costs) return;
    const csv = exportDailyCostsCsv(costs);
    downloadCsv(csv, `openai-daily-costs-${format(now, 'yyyy-MM-dd')}.csv`);
  }

  function handleExportMonthlyCsv() {
    const csv = exportMonthlySummaryCsv(monthlySummaries);
    downloadCsv(csv, `openai-monthly-summary-${format(now, 'yyyy-MM-dd')}.csv`);
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
      <Header title="Overview" />

      <div className="p-6 space-y-6">

        {/* ── SECTION 1: Accounting Stat Cards ── */}
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
                label="Prepaid Asset Balance"
                value={formatMoney(remaining)}
                color="green"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                }
              />
              <StatCard
                label="Current Period Expense"
                value={formatMoney(currentMonthExpense)}
                suffix={`/ ${format(now, 'MMM')}`}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                }
              />
              <StatCard
                label="YTD Amortization"
                value={formatMoney(totalSpent)}
                trend={
                  summary?.burnTrendPct !== undefined
                    ? { value: summary.burnTrendPct, label: 'vs prev week' }
                    : undefined
                }
                sparklineData={sparkline}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                }
              />
              <StatCard
                label="Utilization Rate"
                value={`${utilization.toFixed(2)}%`}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                  </svg>
                }
              />
            </>
          )}
        </div>

        {/* ── SECTION 2: Current Month Snapshot ── */}
        {!isLoading && (
          <div className="card-hover p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="stat-label">Current Period — {format(now, 'MMMM yyyy')}</h3>
              <span className="text-xs text-navy-400">
                Day {dayOfMonth} of {daysInMonth}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Current month expense */}
              <div>
                <p className="text-xs text-navy-400 mb-1">Period Expense (to date)</p>
                <p className="text-3xl font-bold font-mono text-white">{formatMoney(currentMonthExpense)}</p>
                <div className="mt-2 w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-blue rounded-full transition-all duration-500"
                    style={{ width: `${(dayOfMonth / daysInMonth) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-navy-500 mt-1">{dayOfMonth}/{daysInMonth} days elapsed</p>
              </div>

              {/* Prior month comparison */}
              <div>
                <p className="text-xs text-navy-400 mb-1">vs. Prior Period ({format(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'MMM')})</p>
                <p className="text-3xl font-bold font-mono text-white">{formatMoney(prevMonthExpense)}</p>
                {prevMonthExpense > 0 && (
                  <p className={`text-sm mt-2 flex items-center gap-1 ${monthChange > 0 ? 'text-red-400' : monthChange < 0 ? 'text-green-400' : 'text-navy-400'}`}>
                    {monthChange > 0 ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    ) : monthChange < 0 ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 4.5 15 15m0 0V8.25m0 11.25H8.25" />
                      </svg>
                    ) : null}
                    {monthChange > 0 ? '+' : ''}{formatMoney(monthChange)} ({monthChangePct > 0 ? '+' : ''}{monthChangePct.toFixed(1)}%)
                  </p>
                )}
              </div>

              {/* Projected full-month expense */}
              <div>
                <p className="text-xs text-navy-400 mb-1">Projected Full-Month Expense</p>
                <p className="text-3xl font-bold font-mono text-accent-amber">{formatMoney(projectedMonthExpense)}</p>
                <p className="text-xs text-navy-500 mt-2">
                  Based on {formatMoney(currentMonthSummary?.avgDailyCost ?? 0)}/day avg
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 3: Export Buttons ── */}
        {!isLoading && (
          <div className="card p-4 flex flex-wrap gap-3">
            <span className="text-sm text-navy-300 self-center mr-2">Export:</span>
            <button onClick={handleExportMonthlyCsv} disabled={isLoading} className="btn-secondary text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Monthly Summary CSV
            </button>
            <button onClick={handleExportDailyCsv} disabled={isLoading} className="btn-secondary text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Daily Detail CSV
            </button>
            <button onClick={handleExportPdf} disabled={isLoading} className="btn-primary text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              PDF Report
            </button>
          </div>
        )}

        {/* ── SECTION 4: Prepaid Asset Amortization Schedule ── */}
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : amortizationRows.length > 0 ? (
          <div>
            <h3 className="stat-label mb-3">Prepaid Asset Amortization Schedule</h3>
            <DataTable
              columns={[
                {
                  key: 'month',
                  label: 'Period',
                  render: (r: AmortizationRow) => (
                    <span className="font-mono text-xs">
                      {(() => { try { return format(parseISO(r.month + '-01'), 'MMM yyyy'); } catch { return r.month; } })()}
                    </span>
                  ),
                },
                {
                  key: 'openingBalance',
                  label: 'Opening Balance',
                  align: 'right' as const,
                  render: (r: AmortizationRow) => (
                    <span className="font-mono text-xs text-navy-200">{formatMoney(r.openingBalance)}</span>
                  ),
                },
                {
                  key: 'periodExpense',
                  label: 'Period Expense',
                  align: 'right' as const,
                  render: (r: AmortizationRow) => (
                    <span className="font-mono text-xs font-semibold text-red-400">({formatMoney(r.periodExpense)})</span>
                  ),
                },
                {
                  key: 'closingBalance',
                  label: 'Closing Balance',
                  align: 'right' as const,
                  render: (r: AmortizationRow) => (
                    <span className={`font-mono text-xs font-semibold ${r.closingBalance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatMoney(r.closingBalance)}
                    </span>
                  ),
                },
              ]}
              data={amortizationRows}
              getRowKey={(r: AmortizationRow) => r.month}
              pageSize={12}
            />
          </div>
        ) : null}

        {/* ── Divider ── */}
        {!isLoading && totalSpent > 0 && (
          <div className="flex items-center gap-4 pt-2">
            <div className="flex-1 h-px bg-navy-700/50" />
            <span className="text-xs text-navy-500 uppercase tracking-wider">Operational Detail</span>
            <div className="flex-1 h-px bg-navy-700/50" />
          </div>
        )}

        {/* ── SECTION 5: Existing Technical Widgets ── */}

        {/* Gauge + Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            {isLoading ? (
              <GaugeSkeleton />
            ) : (
              <CreditGauge
                total={credits?.totalGranted ?? TOTAL_CREDIT_GRANT}
                used={totalSpent}
                remaining={remaining}
              />
            )}
          </div>
          <div className="lg:col-span-2">
            {isLoading ? (
              <ChartSkeleton height="h-80" />
            ) : (
              <DailyCostChart data={summary?.dailyTrend ?? []} height={300} />
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isLoading ? (
            <>
              <ChartSkeleton />
              <CardSkeleton />
            </>
          ) : (
            <>
              <TopModelsChart data={summary?.topModels ?? []} />
              {/* Burn rates summary */}
              <div className="card-hover p-5">
                <h3 className="stat-label mb-4">Burn Rate Summary</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Daily', value: dailyAvg, color: 'text-accent-blue' },
                    { label: 'Weekly', value: weeklyAvg, color: 'text-accent-cyan' },
                    { label: 'Monthly', value: monthlyAvg, color: 'text-accent-purple' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-navy-300">{item.label}</span>
                      <div className="flex items-center gap-3 flex-1 mx-4">
                        <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min((item.value / (monthlyAvg || 1)) * 100, 100)}%`,
                              backgroundColor: item.color.replace('text-', ''),
                            }}
                          />
                        </div>
                      </div>
                      <span className={`font-mono text-sm font-semibold ${item.color}`}>
                        {formatMoney(item.value)}
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-navy-700/50 pt-4 mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-navy-400">Days of data</span>
                      <span className="font-mono text-navy-200">{summary?.daysOfData ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-navy-400">Trend</span>
                      <span className={`font-mono capitalize ${
                        summary?.burnTrend === 'increasing' ? 'text-red-400' :
                        summary?.burnTrend === 'decreasing' ? 'text-green-400' : 'text-navy-300'
                      }`}>
                        {summary?.burnTrend ?? 'N/A'} {summary?.burnTrendPct !== undefined ? `(${summary.burnTrendPct > 0 ? '+' : ''}${summary.burnTrendPct}%)` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Empty state when no data */}
        {!isLoading && totalSpent === 0 && (
          <div className="card p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy-800 mb-4">
              <svg className="w-8 h-8 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No usage data yet</h3>
            <p className="text-navy-400 text-sm mb-4">
              Configure your OpenAI API key in Settings, then click Refresh to sync data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
