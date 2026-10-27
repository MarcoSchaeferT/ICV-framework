import { NextResponse } from 'next/server';
import { getRuntimeAppConfig } from '@/lib/runtime-app-config';

/** Ensures the deployment flag is evaluated for every request instead of at build time. */
export const dynamic = 'force-dynamic';

/**
 * Returns whether the deployment should present its disclaimer.
 *
 * @returns JSON response shaped as `{ showDisclaimer: boolean }`.
 */
export async function GET() {
  const { showDisclaimer } = getRuntimeAppConfig();
  return NextResponse.json({ showDisclaimer }, { headers: { 'Cache-Control': 'no-store' } });
}
