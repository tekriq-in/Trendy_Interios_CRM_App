import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export const MD_AUTH_FILE = path.join(__dirname, '.auth/md.json');
export const EMP_AUTH_FILE = path.join(__dirname, '.auth/employee.json');

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

async function doLogin(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

setup('authenticate as MD and warm up pages', async ({ page }) => {
  await doLogin(page, 'admin@trendyinteriors.in', 'ChangeMe123!');

  // Warm up all protected pages so Next.js compiles them before tests run
  const pages = [
    '/dashboard/projects',
    '/dashboard/clients',
    '/dashboard/approvals',
    '/dashboard/blockers',
    '/dashboard/handovers',
    '/dashboard/users',
    '/dashboard/departments',
  ];
  for (const p of pages) {
    await page.goto(`${BASE}${p}`);
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  }

  // Save auth state for MD tests
  fs.mkdirSync(path.dirname(MD_AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: MD_AUTH_FILE });
});

setup('authenticate as employee', async ({ page }) => {
  await doLogin(page, 'anbu@trendyinteriors.in', 'Test1234!');
  fs.mkdirSync(path.dirname(EMP_AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: EMP_AUTH_FILE });
});
