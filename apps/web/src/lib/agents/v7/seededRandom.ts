/**
 * Seeded PRNG utility for reproducible agent results.
 *
 * All agents that use randomness (K-Means, Isolation Forest, GMM, etc.)
 * should use this instead of Math.random() to ensure that the same
 * data + same config produces identical results every time.
 *
 * Usage:
 *   import { createRng } from './seededRandom';
 *   const rng = createRng(42); // or createRng(config.seed)
 *   const value = rng(); // 0..1, deterministic
 */

/**
 * Mulberry32 — fast, well-distributed seeded PRNG.
 * Returns a function that produces deterministic random numbers in [0, 1).
 */
export function createRng(seed: number = 42): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a seed from a string (e.g., analysisId or config hash).
 */
export function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash || 42;
}

/**
 * Seeded random integer in [min, max]
 */
export function seededInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Seeded random float in [min, max)
 */
export function seededFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

/**
 * Seeded shuffle (Fisher-Yates)
 */
export function seededShuffle<T>(rng: () => number, array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Seeded sample without replacement
 */
export function seededSample<T>(rng: () => number, array: T[], n: number): T[] {
  return seededShuffle(rng, array).slice(0, n);
}
