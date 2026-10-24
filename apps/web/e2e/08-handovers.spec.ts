import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Handovers', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/handovers');
    await page.waitForLoadState('networkidle');
  });

  test('handovers page loads', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: /handover/i })).toBeVisible();
  });

  test('status labels use plain English, not raw enum values', async ({ page }) => {
    await expect(page.locator('text="draft"')).not.toBeVisible();
    await expect(page.locator('text="confirmed"')).not.toBeVisible();
  });

  test('Raise Handover button opens modal with project dropdown', async ({ page }) => {
    // Use .first() — two buttons exist when list is empty (header + EmptyState CTA)
    await page.locator('button:has-text("Raise Handover")').first().click();
    await expect(page.locator('select').first()).toBeVisible({ timeout: 3000 });
  });

  test('proof photo field is present in raise handover modal', async ({ page }) => {
    await page.locator('button:has-text("Raise Handover")').first().click();
    // Use label locator to avoid strict mode — label text is "Proof files"
    await expect(page.locator('label').filter({ hasText: /proof file/i }).first()).toBeVisible({ timeout: 3000 });
  });

  test('Raise Handover modal can be cancelled', async ({ page }) => {
    await page.locator('button:has-text("Raise Handover")').first().click();
    await expect(page.locator('h2:has-text("Raise Handover")')).toBeVisible();
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('h2:has-text("Raise Handover")')).not.toBeVisible();
  });
});
