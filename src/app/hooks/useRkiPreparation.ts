"use client";

import { useEffect, useState } from "react";
import { aggregateRKI } from "@/app/api_commands";
import { clearDataCache } from "@/app/hooks/useFetchAndCache";

type PreparationStatus = "loading" | "ready" | "error";

// Share concurrent preparation requests across both COVID Vis. Interfaces and
// React development effect replays. A later visit checks the source again.
let pendingPreparation: Promise<void> | null = null;

function prepareInitialRkiData(): Promise<void> {
  if (!pendingPreparation) {
    pendingPreparation = aggregateRKI()
      .then(() => clearDataCache())
      .finally(() => { pendingPreparation = null; });
  }
  return pendingPreparation;
}

/**
 * Prepare the derived RKI relation before mounting views that read it.
 *
 * @param enabled - Whether the preparation should execute (defaults to true).
 */
export function useRkiPreparation(enabled: boolean = true): {
  status: PreparationStatus;
  error: string;
  retry: () => void;
} {
  const [status, setStatus] = useState<PreparationStatus>(enabled ? "loading" : "ready");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    prepareInitialRkiData().then(
      () => { if (active) setStatus("ready"); },
      (reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setStatus("error");
        }
      },
    );
    return () => { active = false; };
  }, [attempt, enabled]);

  const retry = () => {
    if (!enabled) return;
    setError("");
    setStatus("loading");
    setAttempt((current) => current + 1);
  };

  return { status, error, retry };
}
