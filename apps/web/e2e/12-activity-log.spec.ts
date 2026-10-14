import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Activity Log', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/activity-log');
    await page.waitForLoadState('networkidle');
  });

  test('activity log page loads with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /activity log/i })).toBeVisible();
  });

  test('filter bar is visible with all filter inputs', async ({ page }) => {
    // Labels are not associated via htmlFor — locate by placeholder / type
    await expect(page.getByPlaceholder('ObjectId')).toBeVisible();          // Actor ID
    await expect(page.locator('select')).toBeVisible();                      // Entity dropdown
    await expect(page.getByPlaceholder(/approval\.approved/i)).toBeVisible(); // Action
    await expect(page.locator('input[type="date"]').first()).toBeVisible();   // Date From
    await expect(page.locator('input[type="date"]').nth(1)).toBeVisible();    // Date To
  });

  test('Apply Filters and Clear buttons are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /apply filters/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /clear/i })).toBeVisible();
  });

  test('Entity dropdown contains expected options', async ({ page }) => {
    const entitySelect = page.locator('select');
    await expect(entitySelect).toBeVisible();
    await expect(entitySelect.locator('option', { hasText: 'All entities' })).toHaveCount(1);
    await expect(entitySelect.locator('option', { hasText: 'projects' })).toHaveCount(1);
    await expect(entitySelect.locator('option', { hasText: 'approvals' })).toHaveCount(1);
  });

  test('total entries count is shown', async ({ page }) => {
    await expect(page.getByText(/total entries/i)).toBeVisible({ timeout: 8000 });
  });

  test('Apply Filters button triggers a filtered query', async ({ page }) => {
    await page.locator('select').selectOption('projects');
    await page.getByRole('button', { name: /apply filters/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/total entries/i)).toBeVisible({ timeout: 8000 });
  });

  test('Clear button resets the entity filter', async ({ page }) => {
    await page.locator('select').selectOption('approvals');
    await expect(page.locator('select')).toHaveValue('approvals');
    await page.getByRole('button', { name: /clear/i }).click();
    await expect(page.locator('select')).toHaveValue('');
  });
});
