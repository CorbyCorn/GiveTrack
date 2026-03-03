'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/layout/header';
import ForecastChart from '@/components/charts/forecast-chart';
import StatCard from '@/components/ui/stat-card';
import { ChartSkeleton, CardSkeleton } from '@/components/ui/loading-skeleton';
import { useDailyCosts } from '@/lib/hooks';
import { linearForecast, weightedForecast, scenarioForecast } from '@/lib/forecast';
import { formatMoney, formatDate } from '@/lib/format';
import { TOTAL_CREDIT_GRANT } from '@/lib/constants';
import type { ScenarioParams } from '@/lib/types';

export default function ForecastPage() {
  const { data: costs, isLoading } = useDailyCosts();

  const [scenarioParams, setScenarioParams] = useState<ScenarioParams>({
    growthRate: 5,
    modelMixShift: 0,
    additionalSpend: 0,
    budgetCap: 0,
  });

  const [activeMethods, setActiveMethods] = useState<Set<string>>(new Set(['linear', 'weighted', 'scenario']));

  const forecasts = useMemo(() => {
    if (!costs || costs.length < 2) return [];
    const results = [];

    if (activeMethods.has('linear')) {
      results.push(linearForecast(costs, TOTAL_CREDIT_GRANT));
    }
    if (activeMethods.has('weighted')) {
      results.push(weightedForecast(costs, TOTAL_CREDIT_GRANT));
    }
    if (activeMethods.has('scenario')) {
      results.push(scenarioForecast(costs, scenarioParams, TOTAL_CREDIT_GRANT));
    }

    return results;
  }, [costs, scenarioParams, activeMethods]);

  function toggleMethod(method: string) {
    setActiveMethods((prev) => {
      const next = new Set(prev);
      if (next.has(method)) next.delete(method);
      else next.add(method);
      return next;
    });
  }

  function updateParam<K extends keyof ScenarioParams>(key: K, value: ScenarioParams[K]) {
    setScenarioParams((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="animate-fade-in">
      <Header title="Forecasting" />

      <div className="p-6 space-y-6">
        {/* Method toggles */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'linear', label: 'Linear Regression', color: 'bg-blue-500' },
              { id: 'weighted', label: 'Weighted / Seasonal', color: 'bg-purple-500' },
              { id: 'scenario', label: 'Scenario Model', color: 'bg-amber-500' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => toggleMethod(m.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeMethods.has(m.id)
                    ? 'bg-navy-700 text-white border border-navy-500'
                    : 'bg-navy-800/50 text-navy-400 border border-navy-700/50 hover:border-navy-600'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${activeMethods.has(m.id) ? m.color : 'bg-navy-600'}`} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scenario sliders */}
        {activeMethods.has('scenario') && (
          <div className="card p-5">
            <h3 className="stat-label mb-4">Scenario Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="flex justify-between text-xs text-navy-300 mb-2">
                  <span>Monthly Growth Rate</span>
                  <span className="font-mono text-accent-blue">{scenarioParams.growthRate}%</span>
                </label>
                <input
                  type="range"
                  min={-20}
                  max={50}
                  step={1}
                  value={scenarioParams.growthRate}
                  onChange={(e) => updateParam('growthRate', Number(e.target.value))}
                  className="w-full accent-accent-blue"
                />
                <div className="flex justify-between text-[10px] text-navy-500 mt-1">
                  <span>-20%</span>
                  <span>50%</span>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-xs text-navy-300 mb-2">
                  <span>Model Mix Shift</span>
                  <span className="font-mono text-accent-purple">{scenarioParams.modelMixShift}%</span>
                </label>
                <input
                  type="range"
                  min={-50}
                  max={100}
                  step={5}
                  value={scenarioParams.modelMixShift}
                  onChange={(e) => updateParam('modelMixShift', Number(e.target.value))}
                  className="w-full accent-accent-purple"
                />
                <div className="flex justify-between text-[10px] text-navy-500 mt-1">
                  <span>-50% (cheaper)</span>
                  <span>+100% (pricier)</span>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-xs text-navy-300 mb-2">
                  <span>Additional Daily Spend</span>
                  <span className="font-mono text-accent-amber">{formatMoney(scenarioParams.additionalSpend)}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={50000}
                  step={500}
                  value={scenarioParams.additionalSpend}
                  onChange={(e) => updateParam('additionalSpend', Number(e.target.value))}
                  className="w-full accent-accent-amber"
                />
                <div className="flex justify-between text-[10px] text-navy-500 mt-1">
                  <span>$0</span>
                  <span>$50K</span>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-xs text-navy-300 mb-2">
                  <span>Monthly Budget Cap</span>
                  <span className="font-mono text-accent-green">{scenarioParams.budgetCap > 0 ? formatMoney(scenarioParams.budgetCap) : 'None'}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={5000000}
                  step={100000}
                  value={scenarioParams.budgetCap}
                  onChange={(e) => updateParam('budgetCap', Number(e.target.value))}
                  className="w-full accent-accent-green"
                />
                <div className="flex justify-between text-[10px] text-navy-500 mt-1">
                  <span>No cap</span>
                  <span>$5M</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Forecast results cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : (
            forecasts.map((f) => (
              <div key={f.method} className="card-hover p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    f.method === 'linear' ? 'bg-blue-500' :
                    f.method === 'weighted' ? 'bg-purple-500' : 'bg-amber-500'
                  }`} />
                  <h3 className="stat-label capitalize">{f.method} Forecast</h3>
                </div>
                <p className="stat-value text-white mb-2">
                  {f.exhaustionDate ? formatDate(f.exhaustionDate) : 'Never (at current rate)'}
                </p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-navy-300">
                    <span>Projected daily cost</span>
                    <span className="font-mono">{formatMoney(f.projectedDailyCost)}</span>
                  </div>
                  {f.confidence.low && f.confidence.high && (
                    <div className="flex justify-between text-navy-400">
                      <span>Confidence range</span>
                      <span className="font-mono text-[11px]">
                        {formatDate(f.confidence.low)} — {formatDate(f.confidence.high)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chart */}
        {isLoading ? (
          <ChartSkeleton height="h-[420px]" />
        ) : costs && costs.length >= 2 ? (
          <ForecastChart
            historicalData={costs}
            forecasts={forecasts}
            totalCredits={TOTAL_CREDIT_GRANT}
          />
        ) : (
          <div className="card p-12 text-center">
            <p className="text-navy-400">Need at least 2 days of data to generate forecasts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
