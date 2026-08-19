import { NextResponse } from 'next/server';

/** Ensures the deployment flag is evaluated for every request instead of at build time. */
export const dynamic = 'force-dynamic';

/**
 * Returns whether COVID-related UI is enabled for the deployment.
 *
 * @returns JSON response shaped as `{ showCov: boolean }`.
 * @default showCov false when the environment variable is absent or empty.
 */
export async function GET() {
  const envVal = process.env['NEXT_PUBLIC_SHOW_COV'];
  const showCov = envVal === 'true';
  return NextResponse.json({ showCov });
}
