import { NextResponse } from 'next/server';

/** Ensures the deployment flag is evaluated for every request instead of at build time. */
export const dynamic = 'force-dynamic';

/**
 * Returns whether the deployment is configured for restricted demo behavior.
 *
 * @returns JSON response shaped as `{ demoMode: boolean }`.
 */
export async function GET() {
  const demoMode = process.env['NEXT_PUBLIC_DEMO_MODE'] === 'true';
  return NextResponse.json({ demoMode });
}
