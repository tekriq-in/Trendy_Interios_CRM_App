import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

test.describe('Roles', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/roles');
    await page.waitForLoadState('networkidle');
  });

  test('roles page loads with seeded roles', async ({ page }) => {
    // Scope to main content to avoid sidebar user name collisions
    const main = page.locator('#main-content');
    await expect(main.getByRole('heading', { name: 'Roles', level: 1 })).toBeVisible();
    // Role cards use <span class="font-semibold">Name</span>
    await expect(main.locator('span.font-semibold', { hasText: 'MD' })).toBeVisible({ timeout: 8000 });
    await expect(main.locator('span.font-semibold', { hasText: 'GM' })).toBeVisible();
    await expect(main.locator('span.font-semibold', { hasText: /department head/i })).toBeVisible();
    await expect(main.locator('span.font-semibold', { hasText: /employee/i })).toBeVisible();
  });

  test('system roles show a system badge', async ({ page }) => {
    const systemBadges = page.locator('#main-content span', { hasText: 'system' });
    await expect(systemBadges.first()).toBeVisible({ timeout: 8000 });
    const count = await systemBadges.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('system roles do not show a delete button', async ({ page }) => {
    await expect(page.locator('#main-content span.font-semibold', { hasText: 'MD' })).toBeVisible({ timeout: 8000 });
    // MD card — find by closest role card ancestor
    const mdCard = page.locator('#main-content .bg-white').filter({ has: page.locator('span.font-semibold', { hasText: 'MD' }) }).first();
    await expect(mdCard).toBeVisible();
    await expect(mdCard.locator('[aria-label*="Delete role"]')).not.toBeVisible();
  });

  test('New Role button opens modal with permission groups', async ({ page }) => {
    await page.locator('#main-content').getByRole('button', { name: /new role/i }).click();
    const modal = page.locator('[role="dialog"], .fixed.inset-0').last();
    await expect(page.getByRole('heading', { name: /new role/i })).toBeVisible({ timeout: 5000 });
    // Permission group labels inside the modal
    await expect(page.locator('.text-xs.font-semibold.text-slate-400', { hasText: 'Users' })).toBeVisible();
    await expect(page.locator('.text-xs.font-semibold.text-slate-400', { hasText: 'Projects' })).toBeVisible();
    await expect(page.locator('.text-xs.font-semibold.text-slate-400', { hasText: 'Approvals' })).toBeVisible();
  });

  test('New Role form validates empty name', async ({ page }) => {
    await page.locator('#main-content').getByRole('button', { name: /new role/i }).click();
    await expect(page.getByRole('heading', { name: /new role/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.getByText(/role name is required/i)).toBeVisible();
  });

  test('Edit button on a role card opens the edit modal', async ({ page }) => {
    await expect(page.locator('#main-content span.font-semibold', { hasText: 'MD' })).toBeVisible({ timeout: 8000 });
    // Each role card has an edit (pencil) button — first one
    const firstEditBtn = page.locator('#main-content button[class*="hover:text-indigo"]').first();
    await firstEditBtn.click();
    await expect(page.getByRole('heading', { name: /edit role/i })).toBeVisible({ timeout: 5000 });
    // Name input should have a value (pre-populated) — scope to modal to avoid header search input
    const nameInput = page.locator('.rounded-2xl input[placeholder*="Site Supervisor"]');
    const val = await nameInput.inputValue();
    expect(val.length).toBeGreaterThan(0);
  });

  test('New Role modal can be cancelled', async ({ page }) => {
    await page.locator('#main-content').getByRole('button', { name: /new role/i }).click();
    await expect(page.getByRole('heading', { name: /new role/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: /new role/i })).not.toBeVisible();
  });
});
