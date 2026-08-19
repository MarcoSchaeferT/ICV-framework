import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines conditional class names and resolves conflicting Tailwind utilities.
 *
 * @param inputs - Values accepted by `clsx`.
 * @returns A normalized Tailwind class string in which later conflicting utilities win.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
