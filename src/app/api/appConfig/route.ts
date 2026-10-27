import { NextResponse } from 'next/server';
import { getRuntimeAppConfig } from '@/lib/runtime-app-config';

/** Ensures the deployment flags are evaluated for every request instead of at build time. */
export const dynamic = 'force-dynamic';

/**
 * Returns all deployment configuration flags in a single response.
 *
 * @returns JSON response with the current public UI flags.
 */
export async function GET() {
  const { demoMode, showCov, showLegalTexts, showLayoutTemplates } = getRuntimeAppConfig();

  return NextResponse.json(
    { demoMode, showCov, showLegalTexts, showLayoutTemplates },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
