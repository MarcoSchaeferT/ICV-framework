import { NextResponse } from 'next/server';

export async function GET() {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  return NextResponse.json({ demoMode });
}
