import { NextResponse } from 'next/server';

/** Ensures the deployment flag is evaluated for every request instead of at build time. */
export const dynamic = 'force-dynamic';

/**
 * Returns whether legal-text navigation is enabled for the deployment.
 *
 * @returns JSON response shaped as `{ showLegalTexts: boolean }`.
 */
export async function GET() {
  const showLegalTexts = process.env['NEXT_PUBLIC_SHOW_LEGAL_TEXTS'] === 'true';
  return NextResponse.json({ showLegalTexts });
}
