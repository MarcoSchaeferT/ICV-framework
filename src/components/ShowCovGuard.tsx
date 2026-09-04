"use client"

import React from 'react';
import { useUIContext } from './contexts/UIContext';

/**
 * Conditionally renders its children based on the `NEXT_PUBLIC_SHOW_COV` deployment flag.
 *
 * @param props - React children to render when COVID content is enabled.
 * @returns The children when `showCov` is `true`, otherwise `null`.
 *
 * @example
 * ```mdx
 * import ShowCovGuard from "@/components/ShowCovGuard"
 *
 * <ShowCovGuard>
 *   <span id="CalendarTargetDate"><CalendarTargetDate/></span>
 * </ShowCovGuard>
 * ```
 */
export default function ShowCovGuard({ children }: { children: React.ReactNode }) {
  const { showCov } = useUIContext();
  if (!showCov) return null;
  return <>{children}</>;
}
