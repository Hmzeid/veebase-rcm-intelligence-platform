import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Liveness/readiness probe for orchestrators and load balancers. */
export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let claimCount = 0;
  try {
    claimCount = await db.claim.count();
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json(
    {
      status: dbOk ? 'ok' : 'degraded',
      service: 'veebase-rcm-intelligence',
      version: '1.0.0',
      database: dbOk ? 'connected' : 'unavailable',
      claims: claimCount,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}
