'use client';

import { useEffect, useState } from 'react';

interface CreditGaugeProps {
  total: number;
  used: number;
  remaining: number;
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CreditGauge({ total, used, remaining }: CreditGaugeProps) {
  const [animatedPct, setAnimatedPct] = useState(0);
  const pct = total > 0 ? (remaining / total) * 100 : 100;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(pct), 100);
    return () => clearTimeout(timer);
  }, [pct]);

  const radius = 80;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const filledLength = (animatedPct / 100) * arcLength;

  const getColor = () => {
    if (pct > 60) return '#10B981';
    if (pct > 30) return '#F59E0B';
    if (pct > 10) return '#F97316';
    return '#EF4444';
  };

  return (
    <div className="card-hover p-6 flex flex-col items-center">
      <h3 className="stat-label mb-4">Credit Remaining</h3>

      <div className="relative w-48 h-48">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-[135deg]">
          {/* Background arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#1E2C4F"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth={stroke}
            strokeDasharray={`${filledLength} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${getColor()}40)` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold font-mono text-white">{pct.toFixed(1)}%</p>
          <p className="text-xs text-navy-400 mt-1">remaining</p>
        </div>
      </div>

      <div className="flex justify-between w-full mt-4 text-sm">
        <div className="text-center">
          <p className="font-mono font-semibold text-green-400">{formatMoney(remaining)}</p>
          <p className="text-[10px] text-navy-400 mt-0.5">Remaining</p>
        </div>
        <div className="text-center">
          <p className="font-mono font-semibold text-red-400">{formatMoney(used)}</p>
          <p className="text-[10px] text-navy-400 mt-0.5">Used</p>
        </div>
        <div className="text-center">
          <p className="font-mono font-semibold text-navy-200">{formatMoney(total)}</p>
          <p className="text-[10px] text-navy-400 mt-0.5">Total Grant</p>
        </div>
      </div>
    </div>
  );
}
