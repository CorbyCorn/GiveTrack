import { NextResponse } from 'next/server';
import { getCreditBalance, getDailyCosts } from '@/lib/redis';
import { TOTAL_CREDIT_GRANT } from '@/lib/constants';

export async function GET() {
  try {
    let balance = await getCreditBalance();

    if (!balance) {
      // Fallback: calculate from cached costs
      const costs = await getDailyCosts();
      const totalUsed = costs.reduce((s, c) => s + c.totalCost, 0);
      balance = {
        totalGranted: TOTAL_CREDIT_GRANT,
        totalUsed,
        remaining: TOTAL_CREDIT_GRANT - totalUsed,
        lastUpdated: new Date().toISOString(),
      };
    }

    return NextResponse.json(balance);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
