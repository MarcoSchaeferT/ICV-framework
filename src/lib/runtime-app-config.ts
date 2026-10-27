import 'server-only';

import type { AppConfig } from './app-config';

/** Reads deployment flags only on the server, at request time. */
export function getRuntimeAppConfig(): AppConfig {
  const env = process.env;
  const enabled = (value: string | undefined) => value?.trim().toLowerCase() === 'true' || value?.trim() === '1';

  return {
    demoMode: enabled(env.DEMO_MODE),
    showDisclaimer: enabled(env.SHOW_DISCLAIMER),
    showCov: enabled(env.SHOW_COV),
    showLegalTexts: enabled(env.SHOW_LEGAL_TEXTS),
    showLayoutTemplates: enabled(env.SHOW_LAYOUT_TEMPLATES),
  };
}
