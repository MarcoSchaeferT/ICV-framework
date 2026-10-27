import { requireRuntimeFlag } from '@/lib/require-runtime-flag';

/** Restricts the data-protection page to deployments with legal texts enabled. */
export default async function LegalPageLayout({ children }: { children: React.ReactNode }) {
  await requireRuntimeFlag('showLegalTexts');
  return children;
}
