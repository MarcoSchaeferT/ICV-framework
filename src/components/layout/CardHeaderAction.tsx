import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** The card header element that receives visualization actions. */
export const CardHeaderActionTarget = createContext<HTMLDivElement | null>(null);

/** Places a visualization-owned control in its card header when one is available. */
export function CardHeaderAction({ children }: { children: ReactNode }) {
  const target = useContext(CardHeaderActionTarget);

  if (!target) return null;

  return createPortal(children, target);
}
