import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');
  });

  test('projects page loads and shows table rows', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: /project/i })).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });
  });

  test('search filters projects', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="title" i], input[placeholder*="client" i]').first();
    await searchInput.fill('Venkat');
    await page.waitForTimeout(400);
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('status filter dropdown exists and works', async ({ page }) => {
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible();
    await selects.first().selectOption('active');
    await page.waitForTimeout(300);
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('New Project button opens modal', async ({ page }) => {
    await page.locator('button:has-text("New Project")').click();
    await expect(page.locator('[class*="modal"], [class*="rounded-2xl"]').first()).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('New Project modal validates — client is required', async ({ page }) => {
    await page.locator('button:has-text("New Project")').click();
    await page.locator('button:has-text("Create project")').click();
    // Error: "Please select a client."
    await expect(page.locator('text=/select a client|client.*required/i')).toBeVisible({ timeout: 3000 });
  });

  test('clicking a project row navigates to detail page', async ({ page }) => {
    await page.locator('table tbody tr').first().click();
    await expect(page).toHaveURL(/\/dashboard\/projects\/.+/);
  });

  test('project detail page shows stage stepper', async ({ page }) => {
    await page.locator('table tbody tr').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=/Enquiry|Measurement|Design|Manufacturing/i').first()).toBeVisible({ timeout: 10000 });
  });
});
