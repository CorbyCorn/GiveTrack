import { NextRequest, NextResponse } from 'next/server';
import { getLastSync, getAlertThresholds, setAlertThresholds } from '@/lib/redis';
import { OPENAI_ADMIN_KEY, OPENAI_ORG_ID } from '@/lib/constants';

export async function GET() {
  try {
    const lastSync = await getLastSync();
    const thresholds = await getAlertThresholds();

    // Mask API key
    const maskedKey = OPENAI_ADMIN_KEY
      ? `${OPENAI_ADMIN_KEY.slice(0, 10)}...${OPENAI_ADMIN_KEY.slice(-4)}`
      : 'Not configured';

    return NextResponse.json({
      apiKey: maskedKey,
      orgId: OPENAI_ORG_ID || 'Not configured',
      lastSync,
      thresholds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.thresholds) {
      await setAlertThresholds(body.thresholds);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
