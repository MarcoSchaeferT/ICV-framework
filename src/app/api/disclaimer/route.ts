import { NextResponse } from 'next/server';

export async function GET() {
  const showDisclaimer = process.env.NEXT_PUBLIC_SHOW_DISCLAIMER === 'true';
  return NextResponse.json({ showDisclaimer });
}
