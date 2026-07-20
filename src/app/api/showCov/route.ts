import { NextResponse } from 'next/server';

export async function GET() {
  const showCov = process.env.NEXT_PUBLIC_SHOW_COV === 'true';
  return NextResponse.json({ showCov });
}
