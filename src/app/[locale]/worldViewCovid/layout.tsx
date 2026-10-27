import { requireRuntimeFlag } from '@/lib/require-runtime-flag';

/** Restricts the COVID world view to deployments with COVID content enabled. */
export default async function CovidPageLayout({ children }: { children: React.ReactNode }) {
  await requireRuntimeFlag('showCov');
  return children;
}
