/**
 * Busara UI - Class Name Utility
 * =================================
 * Combines clsx and tailwind-merge for safe Tailwind class composition.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper precedence handling.
 * Combines clsx (conditional classnames) with tailwind-merge (conflict resolution).
 *
 * @example
 * cn('px-2 py-1', isActive && 'bg-blue-500', 'px-4')
 * // => 'py-1 bg-blue-500 px-4'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export default cn;
