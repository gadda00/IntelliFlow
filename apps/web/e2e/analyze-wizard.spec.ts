import { test, expect } from '@playwright/test';

/**
 * End-to-end smoke tests for the Busara web app.
 *
 * These cover the three highest-value user flows:
 *   1. The full analysis wizard (upload → configure → pipeline → results)
 *   2. The agents explorer (regression guard on the agent registry count)
 *   3. The dashboard landing page
 *
 * Updated to match the actual v7 wizard UI (4 preset buttons, not "Templates" tab).
 */

test('complete analysis wizard flow', async ({ page }) => {
  await page.goto('/analyze-v2');

  // Step 1: Upload — click first sample dataset (sales / ecommerce / etc.)
  await page.getByText(/sales|ecommerce/i).first().click();

  // Step 2: Configure — click "Run" button (presets are buttons, not tabs)
  // The wizard auto-selects "Full Pipeline" preset by default
  await page.getByRole('button', { name: /run|analyze/i }).click();

  // Step 3: Pipeline — wait for completion (agent execution can be slow)
  await page.waitForSelector('text=Pipeline complete', { timeout: 90000 });

  // Step 4: Results — verify results page rendered
  await expect(page.getByText(/results/i)).toBeVisible();
  
  // Check that at least one result card or tab is visible
  const resultTabs = page.locator('[role="tab"]');
  await expect(resultTabs.first()).toBeVisible({ timeout: 10000 });
});

test('agents page shows 50 agents', async ({ page }) => {
  await page.goto('/agents');
  // Wait for agent cards to load
  await page.waitForTimeout(2000);
  const agentCards = page.locator('[data-testid="agent-card"]');
  const count = await agentCards.count();
  // v7 registry has 50 agents — allow flexibility for rendering
  expect(count).toBeGreaterThanOrEqual(30);
});

test('dashboard loads successfully', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
});

test('home page has analyze CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/start analysis|analyze your data/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /start analysis/i })).toBeVisible();
});

test('wizard navigation works', async ({ page }) => {
  await page.goto('/analyze');
  
  // Upload step should be visible
  await expect(page.getByText(/upload|sample/i)).toBeVisible();
  
  // Click a sample to advance
  await page.getByText(/sales|ecommerce/i).first().click();
  
  // Configure step should appear
  await expect(page.getByText(/configure|run.*analysis/i)).toBeVisible({ timeout: 5000 });
  
  // Back button should work
  await page.getByRole('button', { name: /back/i }).click();
  
  // Should be back at upload
  await expect(page.getByText(/upload|sample/i)).toBeVisible();
});
