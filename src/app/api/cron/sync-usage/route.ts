import { NextRequest, NextResponse } from 'next/server';
import { syncAllData } from '@/lib/openai-client';
import { storeDailyCost, storeDailyUsage, storeCreditBalance, setLastSync } from '@/lib/redis';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { costs, usage, credits } = await syncAllData(90);

    // Store all records
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
