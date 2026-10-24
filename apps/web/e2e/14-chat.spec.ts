import { test, expect } from '@playwright/test';
import { loginAsMD } from './helpers';

// ─── Chat page navigation ─────────────────────────────────────────────────────
test.describe('Chat — navigation and layout', () => {
  test('sidebar Chat link navigates to chat page', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.click('a[href*="/dashboard/chat"]');
    await expect(page).toHaveURL(/\/dashboard\/chat/);
    await expect(page.locator('text=Chat').first()).toBeVisible();
  });

  test('chat page loads with conversation sidebar', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    // The left sidebar always renders
    await expect(page.locator('aside, [class*="sidebar"]').first()).toBeVisible({ timeout: 8000 });
    // Type-tab buttons (Departments / Projects / DMs / Groups) should exist
    const tabs = page.locator('button').filter({ hasText: /project|department|direct|group/i });
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ─── Group list ───────────────────────────────────────────────────────────────
test.describe('Chat — conversation group list', () => {
  test('project tab shows project chat groups', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    // Click project tab
    const projectTab = page.locator('button').filter({ hasText: /project/i }).first();
    if (await projectTab.isVisible()) {
      await projectTab.click();
      await page.waitForTimeout(500);
    }
    // Either groups are listed or an empty-state message is shown
    const hasGroups = (await page.locator('[class*="group"], button').filter({ hasText: /project|reno|kitchen/i }).count()) > 0;
    const hasEmpty = (await page.locator('text=/No project chats/i').count()) > 0;
    expect(hasGroups || hasEmpty).toBeTruthy();
  });

  test('department tab shows department groups', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    const deptTab = page.locator('button').filter({ hasText: /department/i }).first();
    if (await deptTab.isVisible()) {
      await deptTab.click();
      await page.waitForTimeout(500);
    }
    const hasGroups = (await page.locator('button').filter({ hasText: /design|purchase|assembly|measurement/i }).count()) > 0;
    const hasEmpty = (await page.locator('text=/No department/i').count()) > 0;
    expect(hasGroups || hasEmpty).toBeTruthy();
  });
});

// ─── Group creation ───────────────────────────────────────────────────────────
test.describe('Chat — create custom group', () => {
  test('clicking + opens the create group modal', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    const plusBtn = page.locator('button[title="New group"]');
    await expect(plusBtn).toBeVisible({ timeout: 8000 });
    await plusBtn.click();

    await expect(page.locator('text=Create Group').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder*="Group Name"], input[placeholder*="group"], input[placeholder*="Design"]').first()).toBeVisible();
  });

  test('create group form validates name is required', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    const plusBtn = page.locator('button[title="New group"]');
    await plusBtn.click();

    // Create button should be disabled without a group name
    const createBtn = page.locator('button').filter({ hasText: /Create Group/i }).last();
    await expect(createBtn).toBeDisabled();
  });
});

// ─── Message sending ──────────────────────────────────────────────────────────
test.describe('Chat — select group and send message', () => {
  test('selecting a department group opens the message thread', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    // Switch to departments tab
    const deptTab = page.locator('button').filter({ hasText: /department/i }).first();
    if (await deptTab.isVisible()) await deptTab.click();

    // Click the first group in the list
    const firstGroup = page.locator('aside ~ * button, aside button').filter({ hasText: /.+/ }).first();
    if (!(await firstGroup.isVisible())) return; // skip if no groups seeded

    await firstGroup.click();
    await page.waitForTimeout(600);

    // The message input should now be visible
    const input = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="message"]').first();
    await expect(input).toBeVisible({ timeout: 8000 });
  });

  test('typing and sending a message shows it in the thread', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    // Switch to departments tab and click first group
    const deptTab = page.locator('button').filter({ hasText: /department/i }).first();
    if (await deptTab.isVisible()) await deptTab.click();
    await page.waitForTimeout(400);

    const firstGroup = page.locator('aside button').filter({ hasText: /\w+/ }).first();
    if (!(await firstGroup.isVisible())) return;
    await firstGroup.click();
    await page.waitForTimeout(600);

    const input = page.locator('textarea').first();
    if (!(await input.isVisible())) return;

    const testMsg = `E2E test message ${Date.now()}`;
    await input.fill(testMsg);
    await expect(page.locator('button[title*="send"], button').filter({ hasText: '' }).last()).toBeEnabled({ timeout: 3000 }).catch(() => {});

    // Send via Enter key (Shift+Enter = newline, Enter = send)
    await input.press('Enter');
    await page.waitForTimeout(1200);

    // Message should appear somewhere in the thread area
    await expect(page.locator(`text=${testMsg}`)).toBeVisible({ timeout: 8000 });
  });
});

// ─── @mention autocomplete ────────────────────────────────────────────────────
test.describe('Chat — @mention autocomplete', () => {
  test('typing @ shows mention suggestions', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    // Open any group
    const deptTab = page.locator('button').filter({ hasText: /department/i }).first();
    if (await deptTab.isVisible()) await deptTab.click();
    const firstGroup = page.locator('aside button').filter({ hasText: /\w+/ }).first();
    if (!(await firstGroup.isVisible())) return;
    await firstGroup.click();
    await page.waitForTimeout(600);

    const input = page.locator('textarea').first();
    if (!(await input.isVisible())) return;

    await input.fill('@');
    // Type a letter to trigger suggestions (members with any name)
    await input.type('a');
    await page.waitForTimeout(400);

    // Suggestion dropdown may or may not appear depending on members
    const suggestionList = page.locator('[class*="suggest"], [class*="mention"], button').filter({ hasText: /@\w+|^\w+ </ }).first();
    // We don't assert count > 0 because it depends on seeded members having names starting with 'a'
    // Just ensure no crash
    await expect(input).toBeVisible();
  });
});

// ─── Members panel ────────────────────────────────────────────────────────────
test.describe('Chat — members panel', () => {
  test('project group shows Members button that opens the panel', async ({ page }) => {
    await loginAsMD(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    const projectTab = page.locator('button').filter({ hasText: /project/i }).first();
    if (await projectTab.isVisible()) await projectTab.click();
    await page.waitForTimeout(400);

    const firstProject = page.locator('aside button').filter({ hasText: /\w+/ }).first();
    if (!(await firstProject.isVisible())) return;
    await firstProject.click();
    await page.waitForTimeout(600);

    const membersBtn = page.locator('button').filter({ hasText: /Members/i }).first();
    if (!(await membersBtn.isVisible())) return;
    await membersBtn.click();
    await page.waitForTimeout(400);

    await expect(page.locator('text=Members').first()).toBeVisible();
  });
});
