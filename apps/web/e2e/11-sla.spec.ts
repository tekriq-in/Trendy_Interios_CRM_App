import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('SLA Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/sla');
    await page.waitForLoadState('networkidle');
  });

  test('SLA settings page loads with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sla settings/i })).toBeVisible();
    await expect(page.getByText(/configure default sla hours/i)).toBeVisible();
  });

  test('SLA table shows Stage and Default Hours column headers', async ({ page }) => {
    // Scope to first table (settings) to avoid collision with breach report table
    const settingsTable = page.locator('table').first();
    await expect(settingsTable.getByRole('columnheader', { name: 'Stage' })).toBeVisible({ timeout: 8000 });
    await expect(settingsTable.getByRole('columnheader', { name: 'Default Hours' })).toBeVisible();
  });

  test('SLA table has rows for seeded departments', async ({ page }) => {
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 8000 });
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    // 8 seeded departments — table may have rows from both SLA + breach report tables
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test('each SLA row has an editable number input for hours', async ({ page }) => {
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 8000 });
    const firstInput = page.locator('tbody tr').first().locator('input[type="number"]');
    await expect(firstInput).toBeVisible();
    const val = await firstInput.inputValue();
    expect(Number(val)).toBeGreaterThan(0);
  });

  test('SLA breach report section is present with a Refresh button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sla breach report/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });

  test('SLA breach report table has correct column headers', async ({ page }) => {
    // Scope to second table (breach report) to avoid collision with settings table
    const reportTable = page.locator('table').nth(1);
    await expect(reportTable.getByRole('columnheader', { name: 'Project' })).toBeVisible({ timeout: 8000 });
    await expect(reportTable.getByRole('columnheader', { name: 'Stage', exact: true })).toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: /hours in stage/i })).toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: /sla hours/i })).toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });
});
