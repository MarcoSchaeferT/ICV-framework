import { NextResponse } from 'next/server';

/** Ensures the deployment flag is evaluated for every request instead of at build time. */
export const dynamic = 'force-dynamic';

/**
 * Returns whether layout templates navigation is enabled for the deployment.
 *
 * @returns JSON response shaped as `{ showLayoutTemplates: boolean }`.
 * @default showLayoutTemplates false when the environment variable is absent or empty.
 */
export async function GET() {
  const envVal = process.env['NEXT_PUBLIC_SHOW_LAYOUT_TEMPLATES'] ?? process.env['SHOW_LAYOUT_TEMPLATES'];
  const showLayoutTemplates = String(envVal).trim().toLowerCase() === 'true' || String(envVal).trim() === '1';
  return NextResponse.json(
    { showLayoutTemplates },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
