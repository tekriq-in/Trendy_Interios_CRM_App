import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Dashboard Overview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('dashboard overview loads stat cards', async ({ page }) => {
    const cards = page.locator('[class*="bg-white"]');
    await expect(cards.first()).toBeVisible();
  });

  test('sidebar navigation links are present', async ({ page }) => {
    // Wait for sidebar nav to fully render after client hydration
    // Use .first() — two nav instances exist: desktop sidebar + mobile dialog sidebar
    await expect(page.locator('nav[aria-label="Main navigation"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/dashboard/projects"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('a[href="/dashboard/clients"]').first()).toBeVisible();
    await expect(page.locator('a[href="/dashboard/approvals"]').first()).toBeVisible();
    await expect(page.locator('a[href="/dashboard/blockers"]').first()).toBeVisible();
    await expect(page.locator('a[href="/dashboard/users"]').first()).toBeVisible();
  });

  test('no payments link in sidebar', async ({ page }) => {
    await expect(page.locator('a[href="/dashboard/payments"]')).not.toBeVisible();
  });

  test('navigating to projects via sidebar works', async ({ page }) => {
    await page.locator('a[href="/dashboard/projects"]').first().click();
    await expect(page).toHaveURL(/\/dashboard\/projects/);
  });
});
