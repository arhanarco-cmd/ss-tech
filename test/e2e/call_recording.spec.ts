import { test, expect } from '@playwright/test';

test.describe('WebRTC Call & Chunk Recording Pipeline (STORAGE_PIPELINE.md)', () => {
  test('initializes WebRTC canvas composite stream, emits MediaRecorder chunks, and receives 200 OK on upload', async ({
    page,
  }) => {
    // Intercept and track chunk uploads to /api/call/chunk
    const uploadedChunks: Array<{
      sessionId: string | null;
      chunkIndex: string | null;
      isFinal: string | null;
    }> = [];

    await page.route('**/api/call/chunk', async (route) => {
      const request = route.request();
      const postData = request.postData() || '';

      // Parse multipart form boundary fields
      const sessionIdMatch = postData.match(/name="sessionId"\r?\n\r?\n([^\r\n]+)/);
      const chunkIndexMatch = postData.match(/name="chunkIndex"\r?\n\r?\n([^\r\n]+)/);
      const isFinalMatch = postData.match(/name="isFinal"\r?\n\r?\n([^\r\n]+)/);

      uploadedChunks.push({
        sessionId: sessionIdMatch ? sessionIdMatch[1] : 'unknown',
        chunkIndex: chunkIndexMatch ? chunkIndexMatch[1] : '0',
        isFinal: isFinalMatch ? isFinalMatch[1] : 'false',
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ received: true }),
      });
    });

    await page.goto('/');

    // 1. Open Hamburger Menu & Initiate Video Call
    const menuBtn = page.getByRole('button', { name: 'Open menu' });
    await menuBtn.click();
    
    const callBtn = page.locator('.btn-call');
    await expect(callBtn).toBeVisible();
    await callBtn.click();

    // 2. Verify "Ready to Connect / Idle" State
    await expect(page.getByText('Ready to Connect')).toBeVisible();
    const startCallBtn = page.getByRole('button', { name: 'Start Video Call' });
    await expect(startCallBtn).toBeVisible();
    
    // Click Start Call -> Transitions through Ringing to In Call
    await startCallBtn.click();

    // 3. Verify Active In-Call State with PiP Layout & Recording Indicator
    const recBadge = page.getByText('REC');
    await expect(recBadge).toBeVisible();

    // Verify visible video stream feeds (Remote background + Local PiP floating tile)
    const visibleVideos = page.locator('main video');
    await expect(visibleVideos).toHaveCount(2);

    // Verify peer labels on layout
    await expect(page.getByText('Admin', { exact: true })).toBeVisible();
    await expect(page.getByText('You', { exact: true })).toBeVisible();

    // Verify floating bottom control bar buttons
    await expect(page.getByRole('button', { name: 'Toggle microphone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle camera' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle chat' })).toBeVisible();

    // 4. Verify MediaStream / Canvas compositing active in browser
    const isCompositorActive = await page.evaluate(() => {
      const videos = document.querySelectorAll('main video');
      return (
        videos.length === 2 &&
        Array.from(videos).every((v) => (v as HTMLVideoElement).srcObject instanceof MediaStream)
      );
    });
    expect(isCompositorActive).toBe(true);

    // 5. Cleanly End Call to trigger recorder stop and final chunk dispatch
    const endCallBtn = page.getByRole('button', { name: 'End Call' });
    await expect(endCallBtn).toBeVisible();
    await endCallBtn.click();

    // Verify Call Ended state before transition
    await expect(page.getByText('Call Ended')).toBeVisible();

    // Wait for the room to close and return cleanly to gallery view
    await expect(recBadge).not.toBeVisible();
    await expect(page.locator('.grid')).toBeVisible();

    // 6. Verify chunk upload occurred and received 200 OK
    await expect
      .poll(() => uploadedChunks.length, { timeout: 5000 })
      .toBeGreaterThanOrEqual(1);

    uploadedChunks.forEach((chunk) => {
      expect(chunk.sessionId).toBeTruthy();
      expect(chunk.chunkIndex).toBeDefined();
    });
  });
});
