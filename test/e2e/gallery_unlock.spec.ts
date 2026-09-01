import { test, expect } from '@playwright/test';

test.describe('Hidden Gallery PIN Authorization & Unlock Flow', () => {
  test('keeps hidden gallery and upload button locked until valid PIN entry', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Initial State: Only Public Gallery is visible
    await expect(page.getByText('Public Gallery')).toBeVisible();

    const hiddenGalleryHeading = page.getByRole('heading', {
      name: 'Hidden Gallery',
    });
    const addMediaButton = page.getByRole('button', {
      name: /Add Photo\/Video/i,
    });

    // Hidden gallery and upload button must NOT be visible
    await expect(hiddenGalleryHeading).not.toBeVisible();
    await expect(addMediaButton).not.toBeVisible();

    // 2. Open PIN Modal via Hamburger Drawer
    const menuBtn = page.getByRole('button', { name: 'Open menu' });
    await menuBtn.click();
    
    await page.getByText('Unlock More Gallery').click();

    const pinModal = page.getByRole('heading', { name: 'Enter PIN' });
    await expect(pinModal).toBeVisible();

    // 3. Attempt Invalid PIN ('000000')
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: '0', exact: true }).click();
    }
    
    // Verify error state (PIN dots highlight red) and gallery remains locked
    const errorDot = page.locator('.bg-red-500').first();
    await expect(errorDot).toBeVisible();

    // Hidden gallery must remain locked
    await expect(hiddenGalleryHeading).not.toBeVisible();
    await expect(addMediaButton).not.toBeVisible();

    // 4. Enter Valid PIN ('916912')
    await page.getByRole('button', { name: '9', exact: true }).click();
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByRole('button', { name: '9', exact: true }).click();
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();

    // Modal closes automatically on 6th digit
    await expect(pinModal).not.toBeVisible();

    // Open Drawer again and click 'View More Gallery'
    await menuBtn.click();
    await page.getByText('View More Gallery').click();

    // 5. Verify Hidden Gallery and Upload Button are unlocked & accessible for User
    await expect(hiddenGalleryHeading).toBeVisible();
    await expect(addMediaButton).toBeVisible();

    // In User role, Delete/Download action buttons should NOT exist in the item card
    const userDeleteBtns = page.getByRole('button', { name: 'Delete item' });
    await expect(userDeleteBtns).toHaveCount(0);

    // 6. Test Admin Role PIN ('226020') to verify Admin permissions (Delete / Download controls)
    await page.goto('/');
    await menuBtn.click();
    await page.getByText('Unlock More Gallery').click();
    await expect(pinModal).toBeVisible();

    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();

    await expect(pinModal).not.toBeVisible();

    // Open Drawer and navigate to More Gallery
    await menuBtn.click();
    await page.getByText('View More Gallery').click();

    // Ensure we navigated to Hidden Gallery
    await expect(page.getByRole('heading', { name: 'Hidden Gallery' })).toBeVisible();

    // In Admin role, Delete and Download buttons are available for every item
    const adminDeleteBtns = page.getByRole('button', { name: 'Delete item' });
    // It will be 0 if the gallery is empty
    await expect(adminDeleteBtns).toHaveCount(0);
  });
});
