import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Clients', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/clients');
    await page.waitForLoadState('networkidle');
  });

  test('clients page shows client cards', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: /client/i })).toBeVisible();
    // At least one card should be visible after seeding
    await expect(page.locator('[class*="grid"] > [class*="bg-white"], [class*="card"]').first()).toBeVisible({ timeout: 8000 });
  });

  test('Add Client button opens modal', async ({ page }) => {
    await page.locator('button').filter({ hasText: /add client|new client/i }).first().click();
    await expect(page.locator('input').first()).toBeVisible({ timeout: 3000 });
  });

  test('Add Client form validates required name', async ({ page }) => {
    await page.locator('button').filter({ hasText: /add client|new client/i }).first().click();
    // Submit without filling name
    await page.locator('button').filter({ hasText: /^(add|save|create)/i }).last().click();
    // Error: "Client name is required."
    await expect(page.locator('text=/name.*required|required.*name/i')).toBeVisible({ timeout: 3000 });
  });

  test('Add Client form validates phone format', async ({ page }) => {
    await page.locator('button').filter({ hasText: /add client|new client/i }).first().click();
    await page.locator('input[placeholder*="name" i], input[placeholder*="Sharma" i]').first().fill('Test Client');
    await page.locator('input[type="tel"], input[placeholder*="phone" i], input[placeholder*="98" i]').first().fill('abc');
    await page.locator('button').filter({ hasText: /^(add|save|create)/i }).last().click();
    // Error: "Enter a valid phone number."
    await expect(page.locator('text=/valid phone|phone.*required/i')).toBeVisible({ timeout: 3000 });
  });
});
