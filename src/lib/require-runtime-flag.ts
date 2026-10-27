import 'server-only';

import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { AppConfig } from './app-config';
import { getRuntimeAppConfig } from './runtime-app-config';

/** Checks a route-level deployment flag before rendering a gated page. */
export async function requireRuntimeFlag(flag: keyof Pick<AppConfig, 'showCov' | 'showLegalTexts'>) {
  await connection();
  if (!getRuntimeAppConfig()[flag]) notFound();
}
