import { expect, test } from '@playwright/test';

type InstrumentedWindow = Window & { gardenTestCounters: { shaders: number } };

test('the HTML loader works before the 3D bundle arrives', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  page.on('close', release);
  await page.route('**/GardenCanvas.*.js', async route => { await waiting; await route.continue(); });
  await page.goto('/garden/');
  await expect(page.locator('#garden-loader')).toBeVisible();
  await expect(page.locator('#garden-experience')).toHaveAttribute('inert', '');
  await expect(page.locator('#garden-loader a').first()).toHaveAttribute('href', '/invitation/');
  await page.screenshot({ path: 'test-results/garden-loader.png' });
  release();
  await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'ready');
  await expect(page.locator('#garden-experience')).not.toHaveAttribute('inert');
});

test('waits for every photo, then navigates and launches all boats without new downloads or shader compilation', async ({ page }) => {
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  await page.addInitScript(() => {
    const counters = { shaders: 0 };
    Object.assign(window, { gardenTestCounters: counters });
    const compile = WebGL2RenderingContext.prototype.compileShader;
    WebGL2RenderingContext.prototype.compileShader = function (shader) {
      counters.shaders++;
      return compile.call(this, shader);
    };
  });
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  page.on('close', release);
  await page.route('**/IMG_7024.*.webp', async route => { await waiting; await route.continue(); });
  await page.goto('/garden/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('garden-gpu-prepared').length > 0);
  await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'loading');
  release();
  await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'ready');
  expect(await page.locator('.garden-memory img').evaluateAll(images => images.every(image =>
    image instanceof HTMLImageElement && image.complete && image.naturalWidth === 640))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('300 32px "Cormorant Garamond Variable"'))).toBe(true);
  const shaderCount = await page.evaluate(() => (window as unknown as InstrumentedWindow).gardenTestCounters.shaders);
  const downloads = requests.length;
  await page.getByRole('button', { name: 'Our story', exact: true }).click();
  for (let index = 1; index <= 5; index++) {
    await page.getByRole('button', { name: new RegExp(`^Photograph ${index}:`) }).click();
    await expect(page.locator('.garden-photo-count')).toContainText(`0${index}`);
  }
  await page.getByRole('button', { name: 'The beginning', exact: true }).click();
  for (const roll of [.75, .1, .47, .47, .75, .1]) {
    // Override only the next random draw: Pool chooses the boat once per launch.
    await page.evaluate(roll => {
      const random = Math.random;
      Math.random = () => { Math.random = random; return roll; };
      document.querySelector<HTMLButtonElement>('.garden-boat-launch')!.click();
    }, roll);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  expect(await page.evaluate(() => (window as unknown as InstrumentedWindow).gardenTestCounters.shaders)).toBe(shaderCount);
  expect(requests.length).toBe(downloads);
  expect(requests.filter(url => !url.startsWith('http://127.0.0.1:4399/'))).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/garden-mobile.png' });
});

test('a failed texture gives an invitation and retry instead of a stuck loader', async ({ page }) => {
  await page.route('**/ground-normal.*.webp', route => route.abort());
  await page.goto('/garden/');
  await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'error');
  await expect(page.getByRole('link', { name: 'Try the garden again' })).toBeVisible();
  await page.getByRole('link', { name: 'Open your invitation ↗' }).click();
  await expect(page).toHaveURL(/\/invitation\/$/);
});

test('reduced motion still completes preparation and supports photo navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/garden/');
  await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'ready');
  await expect(page.getByRole('button', { name: 'Reduced motion', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Our story', exact: true }).click();
  await page.getByRole('button', { name: 'Next photograph', exact: true }).click();
  await expect(page.locator('.garden-photo-count')).toContainText('02');
});

test('WebGL context loss restores the usable fallback after reveal', async ({ page }) => {
  await page.goto('/garden/');
  await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'ready');
  await page.locator('canvas').evaluate(canvas => {
    (canvas as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'error');
  await expect(page.getByRole('link', { name: 'Try the garden again' })).toBeVisible();
  await expect(page.locator('#garden-loader')).not.toHaveAttribute('inert');
});

test('guests without JavaScript can open the invitation', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4399/garden/');
  await expect(page.getByRole('heading', { name: 'Patrick & Amelia' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open your invitation' })).toHaveAttribute('href', '/invitation/');
  await context.close();
});

test('a stalled startup times out with a usable retry', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  page.on('close', release);
  await page.route('**/GardenCanvas.*.js', async route => { await waiting; await route.abort(); });
  await page.goto('/garden/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('garden-start').length > 0);
  await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'error', { timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Try the garden again' })).toBeVisible();
  await expect(page.locator('#garden-loader a').first()).toHaveAttribute('href', '/invitation/');
  release();
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  test('preserves the wider composition, controls, and readiness on a repeat visit', async ({ page }) => {
    // Two full WebGL preparations and screenshots run on a software GPU in CI.
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/garden/');
    await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'ready');
    await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
    await page.getByRole('button', { name: 'Use light EZ-Tree colours' }).click();
    await page.getByRole('button', { name: 'Our story', exact: true }).click();
    await expect(page.locator('.garden-photo-count')).toContainText('01');
    await page.screenshot({ path: 'test-results/garden-desktop.png' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-garden-state', 'ready');
    expect(errors).toEqual([]);
  });
});
