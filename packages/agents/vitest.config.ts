import { defineConfig } from 'vitest/config';

/**
 * Vitest config for @busara/agents.
 *
 * Disables CSS/PostCSS processing (we don't need it for unit tests) and
 * prevents the root postcss.config.mjs from being loaded — Vite would
 * otherwise try to resolve `@tailwindcss/postcss` which isn't a dependency
 * of this package.
 */
export default defineConfig({
  css: {
    postcss: { plugins: [] },
  },
  test: {
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
