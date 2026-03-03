'use client';

import { useState, useMemo } from 'react';
import { format, subDays, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import Header from '@/components/layout/header';
import DataTable from '@/components/ui/data-table';
import StackedUsageChart from '@/components/charts/stacked-usage-chart';
import { ChartSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { useDailyUsage, useDailyCosts } from '@/lib/hooks';
import { formatMoney, formatTokens } from '@/lib/format';
import type { DailyUsageRecord } from '@/lib/types';

type Granularity = 'day' | 'week' | 'month';

export default function UsagePage() {
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [modelFilter, setModelFilter] = useState('');
  const [granularity, setGranularity] = useState<Granularity>('day');

  const { data: usage, isLoading: usageLoading } = useDailyUsage(startDate, endDate);
  const { data: costs, isLoading: costsLoading } = useDailyCosts(startDate, endDate);
  const isLoading = usageLoading || costsLoading;

  // Get all unique models
  const allModels = useMemo(() => {
    if (!usage) return [];
    const models = new Set<string>();
    for (const day of usage) {
      for (const m of day.models) models.add(m.model);
    }
    return Array.from(models).sort();
  }, [usage]);

  // Merge costs into usage
  const mergedData = useMemo(() => {
    if (!usage) return [];
    const costMap = new Map(costs?.map((c) => [c.date, c]) ?? []);

    return usage.map((day) => {
      const costRecord = costMap.get(day.date);
      return {
        ...day,
        totalCost: costRecord?.totalCost ?? day.totalCost,
      };
    });
  }, [usage, costs]);

  // Filter by model
  const filtered = useMemo(() => {
    if (!modelFilter) return mergedData;
    return mergedData.map((day) => ({
      ...day,
      models: day.models.filter((m) => m.model === modelFilter),
    }));
  }, [mergedData, modelFilter]);

  // Aggregate by granularity
  const aggregated = useMemo(() => {
    if (granularity === 'day') return filtered;

    const buckets: Record<string, DailyUsageRecord> = {};
    for (const day of filtered) {
      const d = parseISO(day.date);
      const key = granularity === 'week'
        ? format(startOfWeek(d), 'yyyy-MM-dd')
        : format(startOfMonth(d), 'yyyy-MM');

      if (!buckets[key]) {
        buckets[key] = { date: key, models: [], totalCost: 0, totalTokensIn: 0, totalTokensOut: 0 };
      }
      buckets[key].totalCost += day.totalCost;
      buckets[key].totalTokensIn += day.totalTokensIn;
      buckets[key].totalTokensOut += day.totalTokensOut;

      for (const m of day.models) {
        const existing = buckets[key].models.find((e) => e.model === m.model);
        if (existing) {
          existing.tokensIn += m.tokensIn;
          existing.tokensOut += m.tokensOut;
          existing.requests += m.requests;
          existing.cost += m.cost;
        } else {
          buckets[key].models.push({ ...m });
        }
      }
    }

    return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered, granularity]);

  // Chart data: stacked by model
  const chartModels = useMemo(() => {
    const modelCosts: Record<string, number> = {};
    for (const day of aggregated) {
      for (const m of day.models) {
        modelCosts[m.model] = (modelCosts[m.model] || 0) + m.cost;
      }
    }
    return Object.entries(modelCosts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([m]) => m);
  }, [aggregated]);

  const chartData = useMemo(() => {
    return aggregated.map((day) => {
      const row: { date: string; [model: string]: number | string } = { date: day.date };
      for (const m of chartModels) {
        const modelData = day.models.find((md) => md.model === m);
        row[m] = modelData?.cost ?? 0;
      }
      return row;
    });
  }, [aggregated, chartModels]);

  // Table rows: flatten to per-model-per-day
  const tableRows = useMemo(() => {
    const rows: { date: string; model: string; tokensIn: number; tokensOut: number; requests: number; cost: number }[] = [];
    for (const day of aggregated) {
      for (const m of day.models) {
        rows.push({
          date: day.date,
          model: m.model,
          tokensIn: m.tokensIn,
          tokensOut: m.tokensOut,
          requests: m.requests,
          cost: m.cost,
        });
      }
    }
    return rows;
  }, [aggregated]);

  return (
    <div className="animate-fade-in">
      <Header title="Usage Breakdown" />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-navy-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-sm py-1.5 w-40"
              />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field text-sm py-1.5 w-40"
              />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Model</label>
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="input-field text-sm py-1.5 w-48"
              >
                <option value="">All Models</option>
                {allModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Granularity</label>
              <div className="flex rounded-lg overflow-hidden border border-navy-600">
                {(['day', 'week', 'month'] as Granularity[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                      granularity === g ? 'bg-accent-blue text-white' : 'bg-navy-800 text-navy-300 hover:bg-navy-700'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 ml-auto">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => {
                    setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
                    setEndDate(format(new Date(), 'yyyy-MM-dd'));
                  }}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        {isLoading ? (
          <ChartSkeleton height="h-96" />
        ) : (
          <StackedUsageChart data={chartData} models={chartModels} />
        )}

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={10} />
        ) : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{r.date}</span> },
              { key: 'model', label: 'Model', render: (r) => <span className="text-accent-blue">{r.model}</span> },
              { key: 'tokensIn', label: 'Tokens In', align: 'right', render: (r) => <span className="font-mono text-xs">{formatTokens(r.tokensIn)}</span> },
              { key: 'tokensOut', label: 'Tokens Out', align: 'right', render: (r) => <span className="font-mono text-xs">{formatTokens(r.tokensOut)}</span> },
              { key: 'requests', label: 'Requests', align: 'right', render: (r) => <span className="font-mono text-xs">{r.requests.toLocaleString()}</span> },
              { key: 'cost', label: 'Cost', align: 'right', render: (r) => <span className="font-mono text-xs font-semibold text-green-400">{formatMoney(r.cost)}</span> },
            ]}
            data={tableRows}
            getRowKey={(r, i) => `${r.date}-${r.model}-${i}`}
            pageSize={25}
          />
        )}
      </div>
    </div>
  );
}
