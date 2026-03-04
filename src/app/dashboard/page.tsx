'use client';

import { useMemo, useState } from 'react';
import { format, parseISO, getDaysInMonth } from 'date-fns';
import Header from '@/components/layout/header';
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

interface ModelRow {
  model: string;
  cost: number;
  pct: number;
}

interface DayRow {
  date: string;
  totalCost: number;
  topModel: string;
}

type ExpandedCard = 'consumed' | 'current' | 'avg' | 'months' | null;

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useUsageSummary();
  const { data: credits, isLoading: creditsLoading } = useCreditBalance();
  const { data: costs, isLoading: costsLoading } = useDailyCosts();

  const [expandedCard, setExpandedCard] = useState<ExpandedCard>(null);

  const isLoading = summaryLoading || creditsLoading || costsLoading;

  const totalSpent = summary?.totalSpent ?? 0;
  const remaining = TOTAL_CREDIT_GRANT - totalSpent;
  const dailyAvg = summary?.dailyAvgBurn ?? 0;
  const weeklyAvg = summary?.weeklyAvgBurn ?? 0;
  const monthlyAvg = summary?.monthlyAvgBurn ?? 0;
  const exhaustionDate = summary?.estimatedExhaustionDate;
  const sparkline = summary?.dailyTrend?.slice(-14).map((d) => d.cost) ?? [];
  const monthsRemaining = monthlyAvg > 0 ? remaining / monthlyAvg : 0;

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

  // Average monthly expense across all months
  const avgMonthlyExpense = monthlySummaries.length > 0
    ? monthlySummaries.reduce((s, m) => s + m.totalCost, 0) / monthlySummaries.length
    : 0;

  // Amortization schedule rows
  const amortizationRows = useMemo<AmortizationRow[]>(() => {
    if (monthlySummaries.length === 0) return [];
    return monthlySummaries.map((s, i) => ({
      month: s.month,
      openingBalance: i === 0 ? TOTAL_CREDIT_GRANT : monthlySummaries[i - 1].remainingCredits,
      periodExpense: s.totalCost,
      closingBalance: s.remainingCredits,
    }));
  }, [monthlySummaries]);

  // Month selector state — default to current month
  const now = new Date();
  const currentMonthKey = format(now, 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Selected month data
  const selectedSummary = monthlySummaries.find((s) => s.month === selectedMonth);
  const selectedMonthIdx = monthlySummaries.findIndex((s) => s.month === selectedMonth);
  const prevSummary = selectedMonthIdx > 0 ? monthlySummaries[selectedMonthIdx - 1] : null;

  const selectedMonthExpense = selectedSummary?.totalCost ?? 0;
  const prevMonthExpense = prevSummary?.totalCost ?? 0;
  const monthChange = selectedMonthExpense - prevMonthExpense;
  const monthChangePct = prevMonthExpense > 0 ? (monthChange / prevMonthExpense) * 100 : 0;

  // Days in selected month
  const selectedMonthDate = parseISO(selectedMonth + '-01');
  const daysInSelectedMonth = getDaysInMonth(selectedMonthDate);
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const dayOfMonth = now.getDate();

  // Current month expense for stat card
  const currentMonthSummary = monthlySummaries.find((s) => s.month === currentMonthKey);
  const currentMonthExpense = currentMonthSummary?.totalCost ?? 0;

  // Model breakdown for selected month
  const selectedMonthModels = useMemo<ModelRow[]>(() => {
    if (!costs) return [];
    const map: Record<string, number> = {};
    for (const day of costs) {
      if (!day.date.startsWith(selectedMonth)) continue;
      for (const b of day.breakdown) {
        map[b.model] = (map[b.model] || 0) + b.cost;
      }
    }
    const total = Object.values(map).reduce((s, c) => s + c, 0);
    return Object.entries(map)
      .map(([model, cost]) => ({
        model,
        cost: Math.round(cost * 100) / 100,
        pct: total > 0 ? Math.round((cost / total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [costs, selectedMonth]);

  // Daily costs for selected month
  const selectedMonthDays = useMemo<DayRow[]>(() => {
    if (!costs) return [];
    return costs
      .filter((c) => c.date.startsWith(selectedMonth))
      .map((c) => {
        const top = c.breakdown.sort((a, b) => b.cost - a.cost)[0];
        return {
          date: c.date,
          totalCost: Math.round(c.totalCost * 100) / 100,
          topModel: top?.model ?? 'N/A',
        };
      });
  }, [costs, selectedMonth]);

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
    generateMonthlyReport(monthlySummaries, TOTAL_CREDIT_GRANT, totalSpent, remaining);
  }

  function toggleCard(card: ExpandedCard) {
    setExpandedCard((prev) => (prev === card ? null : card));
  }

  function fmtMonth(monthKey: string) {
    try { return format(parseISO(monthKey + '-01'), 'MMM yyyy'); } catch { return monthKey; }
  }

  function fmtMonthShort(monthKey: string) {
    try { return format(parseISO(monthKey + '-01'), 'MMM yyyy'); } catch { return monthKey; }
  }

  return (
    <div className="animate-fade-in">
      <Header title="Overview" />

      <div className="p-6 space-y-6">

        {/* ── STAT CARDS (consumption-focused) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
          ) : (
            <>
              {/* Card 1: Total Consumed */}
              <button
                onClick={() => toggleCard('consumed')}
                className={`card-hover p-5 text-left transition-all ${expandedCard === 'consumed' ? 'ring-2 ring-accent-blue/50' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="stat-label">Total Consumed</span>
                  <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                </div>
                <p className="stat-value text-white">{formatMoney(totalSpent)}</p>
                {summary?.burnTrendPct !== undefined && (
                  <p className={`text-xs mt-1 ${summary.burnTrendPct > 0 ? 'text-red-400' : summary.burnTrendPct < 0 ? 'text-green-400' : 'text-navy-400'}`}>
                    {summary.burnTrendPct > 0 ? '+' : ''}{summary.burnTrendPct}% vs prev week
                  </p>
                )}
                <p className="text-[10px] text-navy-500 mt-2">of {formatMoney(TOTAL_CREDIT_GRANT)} grant — click for details</p>
              </button>

              {/* Card 2: Current Month Expense */}
              <button
                onClick={() => toggleCard('current')}
                className={`card-hover p-5 text-left transition-all ${expandedCard === 'current' ? 'ring-2 ring-accent-green/50' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="stat-label">{format(now, 'MMMM')} Expense</span>
                  <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                </div>
                <p className="stat-value text-white">{formatMoney(currentMonthExpense)}</p>
                <p className="text-[10px] text-navy-500 mt-2">Day {dayOfMonth} of {getDaysInMonth(now)} — click for details</p>
              </button>

              {/* Card 3: Avg Monthly Expense */}
              <button
                onClick={() => toggleCard('avg')}
                className={`card-hover p-5 text-left transition-all ${expandedCard === 'avg' ? 'ring-2 ring-accent-purple/50' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="stat-label">Avg Monthly Expense</span>
                  <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
                  </svg>
                </div>
                <p className="stat-value text-white">{formatMoney(avgMonthlyExpense)}<span className="text-lg text-navy-300 ml-1">/mo</span></p>
                <p className="text-[10px] text-navy-500 mt-2">Across {monthlySummaries.length} months — click for details</p>
              </button>

              {/* Card 4: Months Remaining */}
              <button
                onClick={() => toggleCard('months')}
                className={`card-hover p-5 text-left transition-all ${expandedCard === 'months' ? 'ring-2 ring-accent-amber/50' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="stat-label">Months Remaining</span>
                  <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="stat-value text-accent-amber">
                  {monthsRemaining > 0 ? monthsRemaining.toFixed(1) : 'N/A'}
                  <span className="text-lg text-navy-300 ml-1">mo</span>
                </p>
                <p className="text-[10px] text-navy-500 mt-2">{formatMoney(remaining)} left — click for details</p>
              </button>
            </>
          )}
        </div>

        {/* ── CARD BREAKDOWN PANELS ── */}
        {!isLoading && expandedCard === 'consumed' && (
          <div className="card p-6 animate-fade-in border-l-4 border-blue-500/50">
            <h3 className="text-sm font-semibold text-white mb-4">Total Consumed — Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Original credit grant</span>
                <span className="font-mono text-navy-200">{formatMoney(TOTAL_CREDIT_GRANT)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Total consumed (all periods)</span>
                <span className="font-mono text-white font-semibold">{formatMoney(totalSpent)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Remaining balance</span>
                <span className="font-mono text-green-400">{formatMoney(remaining)}</span>
              </div>
              <div className="mt-3 p-3 bg-navy-800/50 rounded-lg">
                <p className="text-xs text-navy-400 font-mono">{formatMoney(TOTAL_CREDIT_GRANT)} − {formatMoney(totalSpent)} = {formatMoney(remaining)} remaining</p>
              </div>
              {monthlySummaries.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-navy-400 mb-2">By period:</p>
                  {monthlySummaries.map((s) => (
                    <div key={s.month} className="flex justify-between text-xs py-0.5">
                      <span className="text-navy-400 font-mono">{fmtMonth(s.month)}</span>
                      <span className="font-mono text-navy-200">{formatMoney(s.totalCost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!isLoading && expandedCard === 'current' && (
          <div className="card p-6 animate-fade-in border-l-4 border-green-500/50">
            <h3 className="text-sm font-semibold text-white mb-4">{format(now, 'MMMM yyyy')} — Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Expense to date</span>
                <span className="font-mono text-white font-semibold">{formatMoney(currentMonthExpense)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Days with data</span>
                <span className="font-mono text-navy-200">{currentMonthSummary?.daysActive ?? 0} of {dayOfMonth} elapsed</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Avg daily</span>
                <span className="font-mono text-navy-200">{formatMoney(currentMonthSummary?.avgDailyCost ?? 0)}/day</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Projected full month</span>
                <span className="font-mono text-accent-amber">{formatMoney((currentMonthSummary?.avgDailyCost ?? 0) * getDaysInMonth(now))}</span>
              </div>
              <div className="mt-2 w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                <div className="h-full bg-accent-blue rounded-full transition-all" style={{ width: `${(dayOfMonth / getDaysInMonth(now)) * 100}%` }} />
              </div>
              <p className="text-[10px] text-navy-500">{dayOfMonth}/{getDaysInMonth(now)} days elapsed</p>
            </div>
          </div>
        )}

        {!isLoading && expandedCard === 'avg' && (
          <div className="card p-6 animate-fade-in border-l-4 border-purple-500/50">
            <h3 className="text-sm font-semibold text-white mb-4">Avg Monthly Expense — Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Average monthly</span>
                <span className="font-mono text-white font-semibold">{formatMoney(avgMonthlyExpense)}/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Average daily</span>
                <span className="font-mono text-navy-200">{formatMoney(dailyAvg)}/day</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Average weekly</span>
                <span className="font-mono text-navy-200">{formatMoney(weeklyAvg)}/wk</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Months of data</span>
                <span className="font-mono text-navy-200">{monthlySummaries.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Days of data</span>
                <span className="font-mono text-navy-200">{summary?.daysOfData ?? 0}</span>
              </div>
              <div className="mt-4">
                <p className="text-xs text-navy-400 mb-2">Month-over-month:</p>
                {monthlySummaries.map((s) => {
                  const maxCost = Math.max(...monthlySummaries.map((m) => m.totalCost));
                  return (
                    <div key={s.month} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="text-navy-400 font-mono w-16">{fmtMonthShort(s.month)}</span>
                      <div className="flex-1 h-1.5 bg-navy-800 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-purple rounded-full" style={{ width: `${maxCost > 0 ? (s.totalCost / maxCost) * 100 : 0}%` }} />
                      </div>
                      <span className="font-mono text-navy-200 w-16 text-right">{formatMoney(s.totalCost)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!isLoading && expandedCard === 'months' && (
          <div className="card p-6 animate-fade-in border-l-4 border-amber-500/50">
            <h3 className="text-sm font-semibold text-white mb-4">Months Remaining — Calculation</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Remaining balance</span>
                <span className="font-mono text-green-400">{formatMoney(remaining)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-300">Avg monthly burn</span>
                <span className="font-mono text-navy-200">{formatMoney(monthlyAvg)}/mo</span>
              </div>
              <div className="border-t border-navy-700/50 pt-3 flex justify-between text-sm font-semibold">
                <span className="text-white">Months remaining</span>
                <span className="font-mono text-accent-amber">{monthsRemaining > 0 ? `${monthsRemaining.toFixed(1)} months` : 'N/A'}</span>
              </div>
              <div className="mt-3 p-3 bg-navy-800/50 rounded-lg">
                <p className="text-xs text-navy-400 font-mono">{formatMoney(remaining)} / {formatMoney(monthlyAvg)} per month = {monthsRemaining > 0 ? `${monthsRemaining.toFixed(1)} months` : 'N/A'}</p>
              </div>
              {exhaustionDate && (
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-navy-300">Est. exhaustion date</span>
                  <span className="font-mono text-red-400">{formatDate(exhaustionDate)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MONTH SELECTOR ── */}
        {!isLoading && monthlySummaries.length > 0 && (
          <>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-navy-700/50" />
              <span className="text-xs text-navy-500 uppercase tracking-wider">Monthly Breakdown</span>
              <div className="flex-1 h-px bg-navy-700/50" />
            </div>

            <div className="flex flex-wrap gap-2">
              {monthlySummaries.map((s) => (
                <button
                  key={s.month}
                  onClick={() => setSelectedMonth(s.month)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedMonth === s.month
                      ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20'
                      : 'bg-navy-800 text-navy-300 hover:bg-navy-700 hover:text-white border border-navy-700'
                  }`}
                >
                  {fmtMonthShort(s.month)}
                  <span className={`ml-2 text-xs ${selectedMonth === s.month ? 'text-blue-200' : 'text-navy-500'}`}>
                    {formatMoney(s.totalCost)}
                  </span>
                </button>
              ))}
            </div>

            {/* ── SELECTED MONTH DETAIL ── */}
            <div className="card-hover p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">{fmtMonth(selectedMonth)}</h3>
                  <p className="text-xs text-navy-400 mt-1">
                    {selectedSummary?.daysActive ?? 0} days with data
                    {isCurrentMonth ? ` (${dayOfMonth} of ${daysInSelectedMonth} elapsed)` : ` of ${daysInSelectedMonth}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold font-mono text-white">{formatMoney(selectedMonthExpense)}</p>
                  <p className="text-xs text-navy-400 mt-1">
                    avg {formatMoney(selectedSummary?.avgDailyCost ?? 0)}/day
                  </p>
                </div>
              </div>

              {/* Prior month comparison */}
              {prevSummary && (
                <div className="mb-6 p-4 bg-navy-800/50 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-navy-300">vs. {fmtMonth(prevSummary.month)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-navy-400">{formatMoney(prevMonthExpense)}</span>
                    <span className="text-sm font-mono text-navy-500">→</span>
                    <span className="text-sm font-mono text-white">{formatMoney(selectedMonthExpense)}</span>
                    <span className={`text-sm font-mono font-semibold ${monthChange > 0 ? 'text-red-400' : monthChange < 0 ? 'text-green-400' : 'text-navy-400'}`}>
                      ({monthChange > 0 ? '+' : ''}{formatMoney(monthChange)}, {monthChangePct > 0 ? '+' : ''}{monthChangePct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Model breakdown */}
                <div>
                  <h4 className="stat-label mb-3">Cost by Model</h4>
                  {selectedMonthModels.length > 0 ? (
                    <DataTable
                      columns={[
                        {
                          key: 'model',
                          label: 'Model',
                          render: (r: ModelRow) => <span className="text-accent-blue text-xs">{r.model}</span>,
                        },
                        {
                          key: 'cost',
                          label: 'Cost',
                          align: 'right' as const,
                          render: (r: ModelRow) => <span className="font-mono text-xs font-semibold">{formatMoney(r.cost)}</span>,
                        },
                        {
                          key: 'pct',
                          label: '%',
                          align: 'right' as const,
                          render: (r: ModelRow) => <span className="font-mono text-xs text-navy-300">{r.pct.toFixed(1)}%</span>,
                        },
                      ]}
                      data={selectedMonthModels}
                      getRowKey={(r: ModelRow) => r.model}
                      pageSize={10}
                    />
                  ) : (
                    <p className="text-sm text-navy-500">No model data for this month</p>
                  )}
                </div>

                {/* Daily costs */}
                <div>
                  <h4 className="stat-label mb-3">Daily Costs</h4>
                  {selectedMonthDays.length > 0 ? (
                    <DataTable
                      columns={[
                        {
                          key: 'date',
                          label: 'Date',
                          render: (r: DayRow) => (
                            <span className="font-mono text-xs">
                              {(() => { try { return format(parseISO(r.date), 'MMM d'); } catch { return r.date; } })()}
                            </span>
                          ),
                        },
                        {
                          key: 'totalCost',
                          label: 'Cost',
                          align: 'right' as const,
                          render: (r: DayRow) => <span className="font-mono text-xs font-semibold">{formatMoney(r.totalCost)}</span>,
                        },
                        {
                          key: 'topModel',
                          label: 'Top Model',
                          render: (r: DayRow) => <span className="text-xs text-navy-300">{r.topModel}</span>,
                        },
                      ]}
                      data={selectedMonthDays}
                      getRowKey={(r: DayRow) => r.date}
                      pageSize={15}
                    />
                  ) : (
                    <p className="text-sm text-navy-500">No daily data for this month</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── EXPORT BUTTONS ── */}
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

        {/* ── AMORTIZATION SCHEDULE ── */}
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
                  render: (r: AmortizationRow) => <span className="font-mono text-xs">{fmtMonth(r.month)}</span>,
                },
                {
                  key: 'openingBalance',
                  label: 'Opening Balance',
                  align: 'right' as const,
                  render: (r: AmortizationRow) => <span className="font-mono text-xs text-navy-200">{formatMoney(r.openingBalance)}</span>,
                },
                {
                  key: 'periodExpense',
                  label: 'Period Expense',
                  align: 'right' as const,
                  render: (r: AmortizationRow) => <span className="font-mono text-xs font-semibold text-red-400">({formatMoney(r.periodExpense)})</span>,
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

        {/* ── OPERATIONAL DETAIL DIVIDER ── */}
        {!isLoading && totalSpent > 0 && (
          <div className="flex items-center gap-4 pt-2">
            <div className="flex-1 h-px bg-navy-700/50" />
            <span className="text-xs text-navy-500 uppercase tracking-wider">Operational Detail</span>
            <div className="flex-1 h-px bg-navy-700/50" />
          </div>
        )}

        {/* ── TECHNICAL WIDGETS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            {isLoading ? <GaugeSkeleton /> : (
              <CreditGauge total={TOTAL_CREDIT_GRANT} used={totalSpent} remaining={remaining} />
            )}
          </div>
          <div className="lg:col-span-2">
            {isLoading ? <ChartSkeleton height="h-80" /> : (
              <DailyCostChart data={summary?.dailyTrend ?? []} height={300} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isLoading ? (
            <><ChartSkeleton /><CardSkeleton /></>
          ) : (
            <>
              <TopModelsChart data={summary?.topModels ?? []} />
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
                      <span className={`font-mono text-sm font-semibold ${item.color}`}>{formatMoney(item.value)}</span>
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

        {/* Empty state */}
        {!isLoading && totalSpent === 0 && (
          <div className="card p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy-800 mb-4">
              <svg className="w-8 h-8 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No usage data yet</h3>
            <p className="text-navy-400 text-sm mb-4">Configure your OpenAI API key in Settings, then click Refresh to sync data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
