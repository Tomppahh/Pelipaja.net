import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/src/backend/lib/session';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function proxy(_req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { // add protected route folders here so only admins can run these routes!
  matcher: ['/api/admin/:path*', '/api/test:path*']
};