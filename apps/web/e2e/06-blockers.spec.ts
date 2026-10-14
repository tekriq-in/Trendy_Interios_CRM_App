import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Blockers', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/blockers');
    await page.waitForLoadState('networkidle');
  });

  test('blockers page loads with table', async ({ page }) => {
    await expect(page.locator('h1, [class*="PageHeader"]').filter({ hasText: /blocker/i })).toBeVisible();
  });

  test('Report a Blocker button opens inline form', async ({ page }) => {
    await page.locator('button:has-text("Report a Blocker"), button:has-text("Raise Blocker")').first().click();
    // Use .first() to avoid strict mode if label text matches multiple elements
    await expect(page.locator('text=/blocking progress|project.*affected/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('blocker form shows project dropdown, not raw ID input', async ({ page }) => {
    await page.locator('button:has-text("Report a Blocker"), button:has-text("Raise Blocker")').first().click();
    // Should be a select, not a text input labelled "Project ID" or "MongoDB"
    await expect(page.locator('input[placeholder*="MongoDB" i], input[placeholder*="ObjectId" i]')).not.toBeVisible();
    await expect(page.locator('select').first()).toBeVisible({ timeout: 5000 });
  });

  test('filter pills switch between statuses', async ({ page }) => {
    const openPill = page.locator('button:has-text("Open")');
    await expect(openPill).toBeVisible();
    await openPill.click();
    // Active pill has different styling
    await expect(openPill).toHaveClass(/bg-indigo-600|text-white/);
  });

  test('Trigger SLA and Mark Resolved buttons have text labels', async ({ page }) => {
    // After seeding there should be some open blockers
    const triggerBtn = page.locator('button:has-text("Trigger SLA")').first();
    const resolveBtn = page.locator('button:has-text("Mark Resolved"), button:has-text("Resolve")').first();
    // At least one should be visible (open or sla_triggered blockers exist)
    const anyActionBtn = page.locator('button:has-text("Trigger SLA"), button:has-text("Mark Resolved")').first();
    await expect(anyActionBtn).toBeVisible({ timeout: 5000 });
  });
});
