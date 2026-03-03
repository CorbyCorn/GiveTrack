'use client';

import Header from '@/components/layout/header';
import StatCard from '@/components/ui/stat-card';
import CreditGauge from '@/components/ui/credit-gauge';
import TopModelsChart from '@/components/charts/top-models-chart';
import DailyCostChart from '@/components/charts/daily-cost-chart';
import { CardSkeleton, GaugeSkeleton, ChartSkeleton } from '@/components/ui/loading-skeleton';
import { useUsageSummary, useCreditBalance } from '@/lib/hooks';
import { formatMoney, formatDate } from '@/lib/format';
import { TOTAL_CREDIT_GRANT } from '@/lib/constants';

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useUsageSummary();
  const { data: credits, isLoading: creditsLoading } = useCreditBalance();

  const isLoading = summaryLoading || creditsLoading;

  // Fallback demo data when no real data
  const totalSpent = summary?.totalSpent ?? 0;
  const remaining = credits?.remaining ?? TOTAL_CREDIT_GRANT;
  const dailyAvg = summary?.dailyAvgBurn ?? 0;
  const weeklyAvg = summary?.weeklyAvgBurn ?? 0;
  const monthlyAvg = summary?.monthlyAvgBurn ?? 0;
  const exhaustionDate = summary?.estimatedExhaustionDate;
  const sparkline = summary?.dailyTrend?.slice(-14).map((d) => d.cost) ?? [];

  return (
    <div className="animate-fade-in">
      <Header title="Overview" />

      <div className="p-6 space-y-6">
        {/* Top stats row */}
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
                label="Total Spent"
                value={formatMoney(totalSpent)}
                trend={
                  summary?.burnTrendPct !== undefined
                    ? { value: summary.burnTrendPct, label: 'vs prev week' }
                    : undefined
                }
                sparklineData={sparkline}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                }
              />
              <StatCard
                label="Daily Avg Burn"
                value={formatMoney(dailyAvg)}
                suffix="/day"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                  </svg>
                }
              />
              <StatCard
                label="Monthly Burn"
                value={formatMoney(monthlyAvg)}
                suffix="/mo"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                }
              />
              <StatCard
                label="Est. Exhaustion"
                value={exhaustionDate ? formatDate(exhaustionDate) : 'N/A'}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                }
              />
            </>
          )}
        </div>

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
