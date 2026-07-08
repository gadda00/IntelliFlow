/**
 * Busara UI - Shared React Component Library
 * ===========================================
 * Re-exports common UI primitives and the `cn` utility used across the platform.
 */

export { cn } from './cn';
export type { ClassValue } from 'clsx';

// Re-export common UI primitives from the web app for cross-package reuse.
// These are kept lightweight to avoid pulling heavy deps into other packages.
export type { ButtonProps } from './types';
