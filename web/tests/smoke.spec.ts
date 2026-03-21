import { test, expect } from '@playwright/test';

test.describe('Web UI Smoke Tests', () => {
  test('homepage loads without errors', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2').first()).toBeVisible();
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Workflows');
    await expect(page).toHaveURL(/\/workflows/);

    await page.click('text=Runs');
    await expect(page).toHaveURL(/\/runs/);

    await page.click('text=Settings');
    await expect(page).toHaveURL(/\/settings/);

    await page.click('text=Home');
    await expect(page).toHaveURL('/');
  });

  test('settings page shows language switcher', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('button:has-text("English")')).toBeVisible();
    await expect(page.locator('button:has-text("简体中文")')).toBeVisible();
  });

  test('settings page allows language switch', async ({ page }) => {
    await page.goto('/settings');

    // Switch to Chinese
    await page.click('button:has-text("简体中文")');
    await expect(page.locator('h2:has-text("设置")')).toBeVisible();

    // Switch back to English
    await page.click('button:has-text("English")');
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
  });
});
