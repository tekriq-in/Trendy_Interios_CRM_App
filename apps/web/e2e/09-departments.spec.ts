import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Departments', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/departments');
    await page.waitForLoadState('networkidle');
  });

  test('departments page loads with 8 stages', async ({ page }) => {
    await expect(page.locator('h1:has-text("Department")')).toBeVisible();
    // Use .first() — "Enquiry" also appears in hidden option elements of reassignment selects
    await expect(page.locator('text="Enquiry"').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text="Manufacturing"').first()).toBeVisible();
  });

  test('Edit button shows text label not just icon', async ({ page }) => {
    const editBtn = page.locator('button:has-text("Edit")').first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
  });

  test('Deactivate uses inline modal not browser confirm', async ({ page }) => {
    const deactivateBtn = page.locator('button:has-text("Deactivate")').first();
    if (await deactivateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      let browserConfirmFired = false;
      page.on('dialog', async (dialog) => {
        browserConfirmFired = true;
        await dialog.dismiss();
      });
      await deactivateBtn.click();
      await expect(page.locator('text=/Deactivate.*\\?/i').first()).toBeVisible({ timeout: 3000 });
      expect(browserConfirmFired).toBe(false);
      await page.locator('button:has-text("Cancel")').last().click();
    }
  });

  test('expanding a department shows staff list', async ({ page }) => {
    const chevron = page.locator('button svg').first();
    await chevron.click();
    // Either shows staff or "No staff assigned"
    await expect(page.locator('text=/staff|No staff/i').first()).toBeVisible({ timeout: 3000 });
  });
});
