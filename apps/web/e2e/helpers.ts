import { Page } from '@playwright/test';

export const MD_EMAIL = 'admin@trendyinteriors.in';
export const MD_PASSWORD = 'ChangeMe123!';
export const EMP_EMAIL = 'anbu@trendyinteriors.in';
export const EMP_PASSWORD = 'Test1234!';
export const BASE_URL = 'http://localhost:3000';
export const API_URL = 'http://localhost:3001/api/v1';

/**
 * Navigate to the dashboard using pre-loaded storageState (no login API call).
 * Falls back to the login form if storageState isn't available (e.g., auth tests
 * that explicitly clear the storage state).
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/dashboard');
  // Wait until we land on either dashboard or login (API 401 redirect)
  await page.waitForURL(/\/(dashboard|login)/, { timeout: 15000 });

  if (!page.url().includes('login')) return; // Already authenticated via storageState

  // Fallback: fill the login form (used by auth tests that clear storageState)
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 25000 });
}

export async function loginAsMD(page: Page) {
  return loginAs(page, MD_EMAIL, MD_PASSWORD);
}
