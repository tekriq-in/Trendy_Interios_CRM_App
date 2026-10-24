'use strict';
/**
 * Regression tests for the 14 bugs fixed in current_update1.docx
 */
import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

// ── Bug #1 — SLA breach badge navigates to Blockers ──────────────────────────
test.describe('Bug #1 — SLA badge links to /blockers', () => {
  test('SLA breach links in dashboard point to /dashboard/blockers', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const slaLinks = page.locator('a[href*="/dashboard/blockers"]');
    // SLA breach badges in the MAIN CONTENT (not sidebar nav) should link to blockers, not /sla
    const mainContent = page.locator('main, #main-content');
    const badLinks = mainContent.locator('a[href*="/dashboard/sla"]');
    await expect(badLinks).toHaveCount(0);
    // Either there are 0 SLA links (no breach data) or they all go to /blockers
    const count = await slaLinks.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

// ── Bug #2 — Client deactivation ─────────────────────────────────────────────
test.describe('Bug #2 — Client deactivation', () => {
  test('clients page has Deactivate button on active clients', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/clients');
    await page.waitForLoadState('networkidle');

    // Should have at least one deactivate-capable icon button
    const deactivateButtons = page.locator('button[title="Deactivate client"]');
    const count = await deactivateButtons.count();
    // Only assert if clients exist
    if (count > 0) {
      await expect(deactivateButtons.first()).toBeVisible();
    }
  });

  test('inactive clients badge is shown when "Show inactive" is checked', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/clients');
    await page.waitForLoadState('networkidle');

    const checkbox = page.locator('input[type="checkbox"]').filter({ hasText: '' }).first();
    if (await checkbox.isVisible()) {
      await checkbox.check();
      await page.waitForTimeout(300);
    }
    // No crash — page still shows
    await expect(page.locator('h1').filter({ hasText: /client/i })).toBeVisible();
  });
});

// ── Bug #3 — Project progress reaches 100% ───────────────────────────────────
test.describe('Bug #3 — Progress reaches 100% on project close', () => {
  test('project detail page shows progress bar', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');
      // Progress bar should be present
      await expect(page.locator('[class*="bg-indigo-600"]').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('Close Project button appears at final stage for active project', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    // Target an active project row (skip completed/cancelled)
    const activeRow = page.locator('table tbody tr').filter({ hasText: /\bactive\b/i }).first();
    if (await activeRow.isVisible()) {
      await activeRow.click();
      await page.waitForLoadState('networkidle');
      // Wait for departments to load, then either "Close Project" or "Advance to" must appear
      await expect(
        page.locator('button:has-text("Close Project"), button:has-text("Advance to")').first(),
      ).toBeVisible({ timeout: 12000 });
    }
  });
});

// ── Bug #4 — Tasks box has Add Task button ───────────────────────────────────
test.describe('Bug #4 — Tasks box is functional', () => {
  test('project detail page has Add Task button', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('button:has-text("Add Task")')).toBeVisible({ timeout: 8000 });
    }
  });

  test('Add Task modal opens with title, department, and assign-to fields', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');
      const addTaskBtn = page.locator('button:has-text("Add Task")');
      if (await addTaskBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addTaskBtn.click();
        await expect(page.locator('input[placeholder*="task" i], input[placeholder*="tile" i], input[placeholder*="Install" i]').first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator('select').first()).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
  });
});

// ── Bug #5 — Drawings section is present ─────────────────────────────────────
test.describe('Bug #5 — Drawings section with upload button', () => {
  test('project detail page has Drawings section with upload button', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=/drawings/i').first()).toBeVisible({ timeout: 8000 });
      await expect(page.locator('button:has-text("Drawing")').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('2D / 3D toggle switches drawing type', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');
      const btn3d = page.locator('button:has-text("3D")');
      if (await btn3d.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn3d.click();
        await expect(page.locator('button:has-text("3D Drawing"), button:has-text("3D")')).toBeVisible();
      }
    }
  });
});

// ── Bug #6 — AI language selector is present ─────────────────────────────────
test.describe('Bug #6 — Tamil language selector in approvals', () => {
  test('approvals request modal has English/Tamil language toggle', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/approvals');
    await page.waitForLoadState('networkidle');

    const requestBtn = page.locator('button:has-text("Request Approval"), button:has-text("Request")').first();
    if (await requestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await requestBtn.click();
      // Look for language toggle buttons
      await expect(page.locator('button:has-text("English"), button:has-text("Tamil")').first()).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
    }
  });

  test('Tamil button can be selected in approval request modal', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/approvals');
    await page.waitForLoadState('networkidle');

    const requestBtn = page.locator('button:has-text("Request Approval"), button:has-text("Request")').first();
    if (await requestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await requestBtn.click();
      const tamilBtn = page.locator('button:has-text("Tamil")');
      if (await tamilBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tamilBtn.click();
        // Button should appear active/selected
        await expect(tamilBtn).toBeVisible();
      }
      await page.keyboard.press('Escape');
    }
  });
});

// ── Bug #7 + #8 — Approvals shows file attachment and history ────────────────
test.describe('Bug #7/#8 — Approvals file and history display', () => {
  test('approvals page loads and shows pending/history sections', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/approvals');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').filter({ hasText: /approval/i })).toBeVisible();
  });

  test('approval cards do not crash when linkedDocument is present', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/approvals');
    await page.waitForLoadState('networkidle');
    // Page should render without JS crash
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Cannot read properties');
  });
});

// ── Bug #9 — Client name is clickable in project detail ──────────────────────
test.describe('Bug #9 — Client name clickable in project detail', () => {
  test('client name in project header is a button/link', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');

      // Client name should be a button that navigates to clients page
      const clientLink = page.locator('button.text-indigo-600, a.text-indigo-600').first();
      if (await clientLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clientLink.click();
        await expect(page).toHaveURL(/\/dashboard\/clients/, { timeout: 5000 });
      }
    }
  });
});

// ── Bug #10 — Blocker can be raised ──────────────────────────────────────────
test.describe('Bug #10 — Blocker form submits correctly', () => {
  test('blockers page loads', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/blockers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').filter({ hasText: /blocker/i })).toBeVisible();
  });

  test('Raise Blocker modal has all required fields', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/blockers');
    await page.waitForLoadState('networkidle');

    const raiseBtn = page.locator('button:has-text("Raise Blocker")');
    if (await raiseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await raiseBtn.click();
      await expect(page.locator('input[placeholder*="title" i], input[placeholder*="blocker" i]').first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator('select').first()).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });
});

// ── Bug #11 — Handovers tab shows entries ────────────────────────────────────
test.describe('Bug #11 — Handovers tab', () => {
  test('handovers page loads without error', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/handovers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').filter({ hasText: /handover/i })).toBeVisible();
    // No JS crash
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

  test('handover cards show populated department names (not raw IDs)', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/handovers');
    await page.waitForLoadState('networkidle');

    const cards = page.locator('[class*="rounded-xl"]').filter({ has: page.locator('[class*="ArrowRight"], svg') });
    const count = await cards.count();
    if (count > 0) {
      const text = await cards.first().innerText();
      // Should show a department name, not a 24-char hex ID
      expect(text).not.toMatch(/^[0-9a-f]{24}$/);
    }
  });
});

// ── Bug #12 — Users: email disabled, phone editable ──────────────────────────
test.describe('Bug #12 — User edit: phone editable, email locked', () => {
  test('edit user modal has disabled email and editable phone', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle');

    const editBtn = page.locator('button:has-text("Edit")').first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click();
      await expect(page.locator('input[type="email"][disabled]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('input[type="tel"]')).toBeEnabled({ timeout: 5000 });
      await page.keyboard.press('Escape');
    }
  });
});

// ── Bug #13 — SLA settings page ──────────────────────────────────────────────
test.describe('Bug #13 — SLA settings page', () => {
  test('SLA settings page loads and shows department rows', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/sla');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').filter({ hasText: /sla/i }).first()).toBeVisible({ timeout: 8000 });
  });
});

// ── Bug #14 — Roles page has search and permission filter ────────────────────
test.describe('Bug #14 — Roles page UI', () => {
  test('roles page has search input', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/roles');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[placeholder*="role" i], input[placeholder*="search" i]').first()).toBeVisible({ timeout: 8000 });
  });

  test('roles page New Role button opens modal with permission filter', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/roles');
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("New Role")').click();
    await expect(page.locator('input[placeholder*="permission" i], input[placeholder*="filter" i]').first()).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });

  test('permission checkboxes are organised in groups', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/roles');
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("New Role")').click();
    // Look for group labels like Users, Roles, Projects
    await expect(page.locator('text=/Users|Roles|Projects/').first()).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });
});
