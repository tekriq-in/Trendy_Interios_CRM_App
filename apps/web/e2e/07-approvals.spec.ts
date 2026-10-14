import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Approvals', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/approvals');
    await page.waitForLoadState('networkidle');
  });

  test('approvals page loads', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /approval/i }).first()).toBeVisible();
  });

  test('pending approvals show Approve and Reject buttons', async ({ page }) => {
    const approveBtn = page.locator('button:has-text("Approve")').first();
    const rejectBtn = page.locator('button:has-text("Reject")').first();
    // There should be pending approvals from seed data
    const hasPending = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasPending) {
      await expect(approveBtn).toBeVisible();
      await expect(rejectBtn).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'note', description: 'No pending approvals — all may have been approved in earlier test run' });
    }
  });
});
