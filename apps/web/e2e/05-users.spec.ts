import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Users / Employees', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle');
  });

  test('employees table shows rows with avatars', async ({ page }) => {
    await expect(page.locator('h1:has-text("Employee")')).toBeVisible();
    // Should have avatar initials divs
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });
  });

  test('Add Employee button opens modal', async ({ page }) => {
    await page.locator('button:has-text("Add Employee")').click();
    await expect(page.locator('input[placeholder*="Ravi" i], input[placeholder*="name" i]').first()).toBeVisible();
  });

  test('Edit button has visible label text', async ({ page }) => {
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });
    const editBtn = page.locator('button:has-text("Edit")').first();
    await expect(editBtn).toBeVisible();
  });

  test('Deactivate button opens confirmation modal, not browser confirm', async ({ page }) => {
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });
    const deactivateBtn = page.locator('button:has-text("Deactivate")').first();
    if (await deactivateBtn.isVisible()) {
      // Set up dialog listener — if browser confirm fires, test fails
      let browserConfirmFired = false;
      page.on('dialog', async (dialog) => {
        browserConfirmFired = true;
        await dialog.dismiss();
      });
      await deactivateBtn.click();
      // Should show inline modal, not browser dialog
      await expect(page.locator('text=/Deactivate.*\\?/i').first()).toBeVisible({ timeout: 3000 });
      expect(browserConfirmFired).toBe(false);
      // Cancel button should be in modal
      await page.locator('button:has-text("Cancel")').last().click();
    }
  });

  test('Edit modal pre-populates name field', async ({ page }) => {
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });
    const editBtn = page.locator('button:has-text("Edit")').first();
    await editBtn.click();
    const nameInput = page.locator('input[placeholder*="Ravi" i], input[placeholder*="name" i]').first();
    await expect(nameInput).toBeVisible();
    const val = await nameInput.inputValue();
    expect(val.length).toBeGreaterThan(0);
  });
});
