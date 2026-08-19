import { NextResponse } from 'next/server';

/** Ensures the deployment flag is evaluated for every request instead of at build time. */
export const dynamic = 'force-dynamic';

/**
 * Returns whether the deployment should present its disclaimer.
 *
 * @returns JSON response shaped as `{ showDisclaimer: boolean }`.
 */
export async function GET() {
  const showDisclaimer = process.env['NEXT_PUBLIC_SHOW_DISCLAIMER'] === 'true';
  return NextResponse.json({ showDisclaimer });
}
