import { test, expect } from '@playwright/test';

test.describe('Role-Based Dynamic Theme Flow (ARCHITECTURE.md §5)', () => {
  test('transitions through Default Purple -> User Pink -> Admin Orange + Glowing Green Call Button', async ({
    page,
  }) => {
    // 1. App Bootstrap (Default Unauthenticated State)
    await page.goto('/');

    const htmlElement = page.locator('html');

    // Verify Default Theme (Purple)
    await expect(htmlElement).toHaveAttribute('data-theme', 'default');
    await expect(htmlElement).toHaveAttribute('data-admin-live', 'false');

    const defaultPrimaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim();
    });
    expect(defaultPrimaryColor.toLowerCase()).toBe('#7c3aed');

    // Open Drawer to access the call button
    const menuBtn = page.getByRole('button', { name: 'Open menu' });
    await menuBtn.click();

    const callBtn = page.locator('.btn-call');
    await expect(callBtn).toBeVisible();

    // Call button should not have green glow initially
    const initialBoxShadow = await callBtn.evaluate(
      (el) => window.getComputedStyle(el).boxShadow
    );
    expect(initialBoxShadow).not.toMatch(/34,\s*197,\s*94/);

    // 2. Authenticate as User via PIN (123456)
    // Click 'Unlock More Gallery' inside the Drawer
    await page.getByText('Unlock More Gallery').click();

    await expect(page.getByRole('heading', { name: 'Enter PIN' })).toBeVisible();

    // Click keypad buttons: 9, 1, 6, 9, 1, 2
    await page.getByRole('button', { name: '9', exact: true }).click();
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByRole('button', { name: '9', exact: true }).click();
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();

    // Modal should close and theme should transition to 'user' (Pink)
    await expect(page.getByRole('heading', { name: 'Enter PIN' })).not.toBeVisible();
    await expect(htmlElement).toHaveAttribute('data-theme', 'user');

    const userPrimaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim();
    });
    expect(userPrimaryColor.toLowerCase()).toBe('#db2777');

    // 3. Authenticate / Switch to Admin Role via PIN (226020)
    await page.goto('/');
    
    // Open drawer again to switch to Admin
    await menuBtn.click();
    await page.getByText('Unlock More Gallery').click();
    await expect(page.getByRole('heading', { name: 'Enter PIN' })).toBeVisible();

    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Enter PIN' })).not.toBeVisible();

    // Verify Admin Theme (Orange)
    await expect(htmlElement).toHaveAttribute('data-theme', 'admin');

    const adminPrimaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim();
    });
    expect(adminPrimaryColor.toLowerCase()).toBe('#ea580c');

    // Open drawer to verify Call Button for Admin
    await menuBtn.click();

    // 4. Admin Connects Live -> Call button acquires Glowing Green indicator automatically via AppStore state
    await expect(htmlElement).toHaveAttribute('data-admin-live', 'true');

    // Poll for the 0.4s CSS box-shadow transition to settle to green glow
    await expect
      .poll(async () => {
        return callBtn.evaluate((el) => window.getComputedStyle(el).boxShadow);
      })
      .toMatch(/34,\s*197,\s*94/);
    
    // We do not test Admin disconnect manually here since it requires a separate client socket,
    // and the visual state is robustly bound to the Zustand store.
  });
});
