import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const showLegalTexts = process.env.NEXT_PUBLIC_SHOW_LEGAL_TEXTS !== 'false';
  return NextResponse.json({ showLegalTexts });
}
