import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const showDisclaimer = process.env['NEXT_PUBLIC_SHOW_DISCLAIMER'] === 'true';
  return NextResponse.json({ showDisclaimer });
}
