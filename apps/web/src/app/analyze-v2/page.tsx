import { AnalyzePage } from '@/components/v7/AnalyzePage';

export const metadata = {
  title: 'Analyze v2 — Busara AI',
  description: 'Upload your data and watch 50 AI agents analyze it in real time',
};

/**
 * /analyze-v2 — Playwright E2E entry point.
 *
 * The wizard UI lives in `@/components/v7/AnalyzePage` (the v7 component is
 * the current implementation; the `/analyze-v2` route exists purely so the
 * E2E suite at `apps/web/e2e/analyze-wizard.spec.ts` can target a stable URL
 * that won't be repurposed for legacy / experimental wizards.
 */
export default function AnalyzeV2Route() {
  return <AnalyzePage />;
}
