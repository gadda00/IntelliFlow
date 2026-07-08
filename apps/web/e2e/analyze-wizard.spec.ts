import { test, expect } from '@playwright/test';

/**
 * End-to-end smoke tests for the Busara web app.
 *
 * These cover the three highest-value user flows:
 *   1. The full analysis wizard (upload → configure → pipeline → results)
 *   2. The agents explorer (regression guard on the agent registry count)
 *   3. The dashboard landing page
 *
 * The wizard test is intentionally lenient — it clicks the first matching
 * sample dataset / template rather than a specific one, so it survives UI
 * copy tweaks. The agent count assertion is a hard regression guard: if the
 * v7 registry shrinks below 33 agents, something is wrong upstream.
 */

test('complete analysis wizard flow', async ({ page }) => {
  await page.goto('/analyze-v2');

  // Step 1: Upload — click first sample dataset (sales / ecommerce / etc.)
  await page.getByText(/sales|ecommerce/i).first().click();

  // Step 2: Configure — select first template then run
  await page.getByRole('tab', { name: /templates/i }).click();
  await page.getByText(/sales analysis/i).click();
  await page.getByRole('button', { name: /run/i }).click();

  // Step 3: Pipeline — wait for completion (LLM calls can be slow)
  await page.waitForSelector('text=Pipeline complete', { timeout: 60000 });

  // Step 4: Results — verify agent result cards rendered
  await expect(page.getByText(/results/i)).toBeVisible();
  const agentCards = page.locator('[data-testid="agent-result-card"]');
  await expect(agentCards.first()).toBeVisible();
});

test('agents page shows 33 agents', async ({ page }) => {
  await page.goto('/agents');
  const agentCards = page.locator('[data-testid="agent-card"]');
  await expect(agentCards).toHaveCount(33);
});

test('dashboard loads', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText(/overview|trajectories|evolution/i)).toBeVisible();
});
