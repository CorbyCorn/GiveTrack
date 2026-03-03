import { NextResponse } from 'next/server';
import { syncAllData } from '@/lib/openai-client';
import { storeDailyCost, storeDailyUsage, storeCreditBalance, setLastSync } from '@/lib/redis';

export const maxDuration = 60;

export async function POST() {
  try {
    const { costs, usage, credits } = await syncAllData(90);

    await Promise.all([
      ...costs.map((c) => storeDailyCost(c)),
      ...usage.map((u) => storeDailyUsage(u)),
      storeCreditBalance(credits),
      setLastSync(new Date().toISOString()),
    ]);

    return NextResponse.json({
      success: true,
      synced: {
        costDays: costs.length,
        usageDays: usage.length,
        creditBalance: credits.remaining,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
