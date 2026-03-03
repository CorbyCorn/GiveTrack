import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_PASSWORD } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json();

    if (currentPassword !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    // Note: In production, password should be stored in a database or environment variable
    // This endpoint validates the current password but cannot persist changes to env vars at runtime
    // Password changes would need to be done via the hosting platform (Vercel env vars)

    return NextResponse.json({
      success: true,
      message: 'Password validated. Update ADMIN_PASSWORD in your environment variables to persist the change.',
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
