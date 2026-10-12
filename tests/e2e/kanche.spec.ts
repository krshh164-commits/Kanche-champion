import { expect, test } from '@playwright/test';

test('opens directly into the simple six-marble mobile level', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  await expect(page.getByRole('region', { name: 'Kanche level one' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Choose a level' })).toBeHidden();
  await expect(page.locator('.hud-card')).toHaveCount(3);
  await expect(page.getByText('MOVES').locator('..')).toContainText('6');
  await expect(page.getByText('OBJECTIVE').locator('..')).toContainText('0 / 6');

  const levelButton = page.getByRole('button', { name: 'Choose level' });
  const levelButtonBox = await levelButton.boundingBox();
  expect(levelButtonBox?.width).toBeGreaterThanOrEqual(44);
  expect(levelButtonBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('button', { name: 'Pause game' })).toHaveCount(0);

  const viewportState = await page.evaluate(() => ({
    overflow: getComputedStyle(document.body).overflow,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight,
  }));
  expect(viewportState.overflow).toBe('hidden');
  expect(viewportState.scrollHeight).toBeLessThanOrEqual(viewportState.innerHeight);
  expect(errors).toEqual([]);
});

test('position, aim, outside release, and settling lock work', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const centerX = box!.x + box!.width / 2;
  const baselineY = box!.y + box!.height * (664 / 780);
  const positionedX = centerX - box!.width * 0.12;

  await page.mouse.move(centerX, baselineY);
  await page.mouse.down();
  await page.mouse.move(positionedX, baselineY);
  await page.mouse.up();
  await expect(page.getByText('MOVES').locator('..')).toContainText('6');

  await page.mouse.move(positionedX, baselineY);
  await page.mouse.down();
  await page.mouse.move(positionedX, baselineY + box!.height * (6 / 780));
  await page.mouse.up();
  await expect(page.getByText('MOVES').locator('..')).toContainText('6');

  await page.mouse.move(positionedX, baselineY);
  await page.mouse.down();
  const outsideX = box!.x > 12 ? box!.x - 8 : box!.x + box!.width + 8;
  await page.mouse.move(outsideX, baselineY + box!.height * (70 / 780));
  await page.mouse.up();
  await expect(page.getByText('MOVES').locator('..')).toContainText('5');

  await page.mouse.click(centerX, baselineY);
  await expect(page.getByText('MOVES').locator('..')).toContainText('5');

});

test('loads Level 2 through the existing selector with its obstacle and objectives', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kanche-progress', JSON.stringify({ completedLevels: { '1': 3 }, highestUnlockedLevel: 2 }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose level' }).click();
  await page.getByRole('button', { name: /2 Teal Orbit/ }).click();

  await expect(page.locator('.objective-count')).toHaveText('6');
  await expect(page.getByText('MOVES').locator('..')).toContainText('6');

  const obstaclePixel = await page.locator('#game-canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    return [...context.getImageData(
      Math.round(canvas.width * 210 / 420),
      Math.round(canvas.height * 162 / 780),
      1,
      1,
    ).data];
  });
  expect(obstaclePixel.slice(0, 3)).toEqual([30, 30, 30]);

  await page.getByRole('button', { name: 'Choose level' }).click();
  await expect(page.getByRole('button', { name: /2 Teal Orbit/ })).toHaveAttribute('aria-current', 'step');
});

test('auto-fits the game and level grid across portrait screens', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const gameLayout = await page.evaluate(() => {
      const rect = (selector: string) => {
        const value = document.querySelector(selector)!.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width };
      };
      const shell = document.querySelector<HTMLElement>('.app-shell')!;
      const shellRect = shell.getBoundingClientRect();
      const shellStyle = getComputedStyle(shell);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        shellWidth: shellRect.width,
        shellPaddingLeft: Number.parseFloat(shellStyle.paddingLeft),
        shellPaddingRight: Number.parseFloat(shellStyle.paddingRight),
        topbar: rect('.game-topbar'),
        canvas: rect('.canvas-wrap'),
        surface: rect('#game-canvas'),
        hint: rect('.game-hint'),
      };
    });

    expect(gameLayout.scrollWidth).toBeLessThanOrEqual(gameLayout.viewportWidth);
    expect(gameLayout.scrollHeight).toBeLessThanOrEqual(gameLayout.viewportHeight);
    expect(gameLayout.shellPaddingLeft).toBeCloseTo(gameLayout.shellPaddingRight, 1);
    expect(gameLayout.canvas.left).toBeCloseTo(gameLayout.viewportWidth - gameLayout.canvas.right, 0);
    expect(gameLayout.canvas.width).toBeLessThanOrEqual(
      gameLayout.shellWidth - gameLayout.shellPaddingLeft - gameLayout.shellPaddingRight + .5,
    );
    expect(gameLayout.surface.width).toBeCloseTo(gameLayout.canvas.width, 0);
    expect(gameLayout.surface.left).toBeCloseTo(gameLayout.canvas.left, 0);
    expect(gameLayout.surface.right).toBeCloseTo(gameLayout.canvas.right, 0);
    expect(gameLayout.surface.bottom).toBeCloseTo(gameLayout.canvas.bottom, 0);
    expect(gameLayout.topbar.left).toBeCloseTo(gameLayout.canvas.left, 0);
    expect(gameLayout.topbar.right).toBeCloseTo(gameLayout.canvas.right, 0);
    expect(gameLayout.canvas.top - gameLayout.topbar.bottom).toBeGreaterThanOrEqual(8);
    expect(gameLayout.hint.top - gameLayout.canvas.bottom).toBeGreaterThanOrEqual(8);
    expect(Math.abs(
      (gameLayout.canvas.top - gameLayout.topbar.bottom)
      - (gameLayout.hint.top - gameLayout.canvas.bottom),
    )).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Choose level' }).click();
    const levelLayout = await page.evaluate(() => {
      const levelPage = document.querySelector<HTMLElement>('.level-page')!;
      const pageStyle = getComputedStyle(levelPage);
      const pageRect = levelPage.getBoundingClientRect();
      const grid = document.querySelector('.level-grid')!.getBoundingClientRect();
      const first = document.querySelector('.level-option')!.getBoundingClientRect();
      const last = document.querySelector('.level-option:last-child')!.getBoundingClientRect();
      return {
        pageWidth: pageRect.width,
        paddingLeft: Number.parseFloat(pageStyle.paddingLeft),
        paddingRight: Number.parseFloat(pageStyle.paddingRight),
        gridWidth: grid.width,
        firstWidth: first.width,
        lastBottom: last.bottom,
      };
    });
    expect(levelLayout.paddingLeft).toBeCloseTo(levelLayout.paddingRight, 1);
    expect(levelLayout.gridWidth).toBeCloseTo(Math.min(
      levelLayout.pageWidth - levelLayout.paddingLeft - levelLayout.paddingRight,
      324,
    ), 0);
    expect(levelLayout.firstWidth).toBeGreaterThanOrEqual(44);
    expect(levelLayout.lastBottom).toBeLessThan(viewport.height);
  }
});
