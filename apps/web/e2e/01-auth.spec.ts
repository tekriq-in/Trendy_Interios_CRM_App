import { test, expect } from '@playwright/test';
import { loginAsMD, loginAs, MD_EMAIL, EMP_EMAIL, EMP_PASSWORD } from './helpers';

// ─── Tests that need a fresh browser with no pre-loaded auth ──────────────────
test.describe('Authentication (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('unauthenticated root redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('wrong password shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.locator('input[type="email"]').fill(MD_EMAIL);
    await page.locator('input[type="password"]').fill('wrongpassword123');
    await page.locator('button[type="submit"]').click();
    // Login stays on /login and shows the error div
    await expect(page.locator('.bg-red-50').first()).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('empty fields are blocked by HTML required', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login/);
  });

  test('MD admin can log in and reach dashboard', async ({ page }) => {
    await loginAsMD(page);
    await expect(page).toHaveURL(/dashboard/);
  });

  test('employee can log in', async ({ page }) => {
    await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
    await expect(page).toHaveURL(/dashboard/);
  });
});

// ─── Tests that need an authenticated session ────────────────────────────────
// These use the default MD storageState from playwright.config.ts so loginAsMD
// just navigates directly to /dashboard — no login API call, no race conditions.
test.describe('Authentication (authenticated)', () => {
  test('sign out button is visible in sidebar', async ({ page }) => {
    await loginAsMD(page);
    // Use .first() — two "Sign out" buttons exist: desktop sidebar + mobile dialog
    await expect(page.locator('button:has-text("Sign out")').first()).toBeVisible({ timeout: 10000 });
  });

  test('sign out clears session and redirects to login', async ({ page }) => {
    await loginAsMD(page);
    const signOutBtn = page.locator('button:has-text("Sign out")').first();
    await expect(signOutBtn).toBeVisible({ timeout: 10000 });
    await signOutBtn.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    // After signout, dashboard should redirect back to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
