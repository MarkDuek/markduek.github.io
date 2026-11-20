import { expect, test } from "@playwright/test";

test("social links sit at the bottom left and remain keyboard accessible", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const social = page.getByRole("navigation", { name: "Social links" });
    const linkedin = social.getByRole("link", { name: "LinkedIn", exact: true });
    const github = social.getByRole("link", { name: "GitHub", exact: true });
    await expect(linkedin).toHaveAttribute("href", "https://www.linkedin.com/in/mark-duek/");
    await expect(github).toHaveAttribute("href", "https://github.com/MarkDuek");
    for (const link of [linkedin, github]) {
      await expect(link.locator("svg")).toBeVisible();
      await expect(link.locator("svg")).toHaveAttribute("aria-hidden", "true");
      expect((await link.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    }
    await expect(linkedin).toHaveText("LinkedIn");
    await expect(github).toHaveText("GitHub");
    await linkedin.focus();
    await expect(linkedin).toBeFocused();
    await expect(linkedin).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Tab");
    await expect(github).toBeFocused();
    const first = (await linkedin.boundingBox())!;
    const second = (await github.boundingBox())!;
    const landing = (await page.locator(".landing").boundingBox())!;
    expect(first.x).toBeCloseTo(Math.max(24, Math.min(80, viewport.width * 0.05)), 1);
    expect(first.y).toBe(second.y);
    expect(first.height).toBeGreaterThanOrEqual(44);
    expect(second.x + second.width).toBeLessThan(viewport.width);
    expect(first.y + first.height).toBeCloseTo(landing.y + landing.height - 32, 1);
    await page.screenshot({ path: info.outputPath(`social-${viewport.width}.png`), fullPage: true });
  }
});

test("main page links turn deep red and enlarge on hover", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: /About/ });
  await link.hover();
  await expect(link).toHaveCSS("color", "rgb(178, 34, 34)");
  await expect(link).toHaveCSS("transform", "matrix(1.05, 0, 0, 1.05, 0, 0)");
  await expect(link).toHaveCSS("text-decoration-line", "none");
});

test("desktop: production ASCII retains the sharper glyphs and rendering resolution", async ({ browser }, info) => {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const upload = WebGLRenderingContext.prototype.texImage2D as (...args: unknown[]) => void;
    WebGLRenderingContext.prototype.texImage2D = function (this: WebGLRenderingContext, ...args: unknown[]) {
      const source = args[5];
      if (source instanceof HTMLCanvasElement) {
        document.documentElement.dataset.glyphAtlas = `${source.width}x${source.height}`;
      }
      return upload.apply(this, args);
    } as typeof WebGLRenderingContext.prototype.texImage2D;
  });
  await page.goto("/");
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("html")).toHaveAttribute("data-glyph-atlas", "640x80");
  const canvas = page.locator("#terrain-canvas");
  const size = await canvas.evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    return { width: canvas.width, pixels: canvas.width * canvas.height };
  });
  expect(size.width).toBeGreaterThan(1920);
  expect(size.width).toBeLessThanOrEqual(4096);
  expect(size.pixels).toBeGreaterThan(3_900_000);
  expect(size.pixels).toBeLessThanOrEqual(4_000_000);
  expect(await canvas.evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext("webgl")!;
    return gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER) === gl.LINEAR;
  })).toBe(true);
  expect(await canvas.evaluate(element => (element as HTMLCanvasElement).getContext("webgl")!.getError())).toBe(0);
  await page.screenshot({ path: info.outputPath("sharp-ascii-retina.png") });
  await context.close();
});

test("desktop: Climate Crisis and the aligned horizontal index are final, without switches", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const heading = page.getByRole("heading", { name: "Mark Duek", exact: true });
  await expect(heading).toHaveCSS("font-family", '"Climate Crisis", sans-serif');
  expect(await page.evaluate(() => Array.from(document.fonts).some(face =>
    face.family === "Climate Crisis" && face.status === "loaded"
  ))).toBe(true);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Title study" })).toHaveCount(0);
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  const bounds = (await navigation.boundingBox())!;
  const copy = (await page.locator(".about p").last().boundingBox())!;
  expect(bounds.x).toBe(72);
  expect(bounds.y).toBeGreaterThan(copy.y + copy.height);
  expect(bounds.width).toBe(copy.width);
  const boxes = await Promise.all((await navigation.getByRole("link").all()).map(link => link.boundingBox()));
  expect(boxes.map(box => box!.y)).toEqual([boxes[0]!.y, boxes[0]!.y, boxes[0]!.y]);
  expect(boxes[0]!.x + boxes[0]!.width).toBeLessThan(boxes[1]!.x);
  expect(boxes[1]!.x + boxes[1]!.width).toBeLessThan(boxes[2]!.x);
  expect(boxes[2]!.x + boxes[2]!.width).toBeCloseTo(copy.x + copy.width, 1);
  await expect(navigation).toHaveCSS("color", "rgb(34, 41, 30)");
  await expect(navigation).toHaveCSS("font-weight", "900");
  await expect(navigation).toHaveCSS("font-family", await page.locator(".about").evaluate(element => getComputedStyle(element).fontFamily));
  await expect(navigation).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".site-label")).toHaveCSS("font-weight", "800");
  const label = (await page.locator(".site-label").boundingBox())!;
  const title = (await heading.boundingBox())!;
  expect(label.y).toBeGreaterThan(title.y + title.height);
  expect(label.x + label.width).toBeCloseTo(title.x + title.width, 1);
  for (const label of await navigation.locator(".link-label").all()) {
    await expect(label).toHaveCSS("background-color", "rgb(234, 232, 220)");
  }
  expect((await heading.boundingBox())!.width).toBeLessThan(600);
  expect((await heading.boundingBox())!.height).toBe(320);
  await page.screenshot({ path: info.outputPath("final-desktop.png") });
});

test("desktop: full ASCII retains title inversion, reduced motion and the static fallback", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  const fieldOnly = { style: ".identity, .about { visibility: hidden !important; }" };
  const canvas = page.locator("#terrain-canvas");
  const printed = await canvas.screenshot(fieldOnly);
  const heading = page.getByRole("heading", { name: "Mark Duek", exact: true });
  await expect(heading).toHaveCSS("mix-blend-mode", "difference");
  await expect(heading).toHaveCSS("color", "rgb(200, 191, 190)");
  expect((await heading.screenshot()).equals(await heading.screenshot({
    style: ".identity h1 { mix-blend-mode: normal !important; color: #22291e !important; }",
  }))).toBe(false);
  const ink = await canvas.evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl")!;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let left = 0;
    let right = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 255 && pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0) {
        if ((i / 4) % canvas.width < canvas.width * 0.58) left++;
        else right++;
      }
    }
    return { left, right, error: gl.getError() };
  });
  expect(ink.left).toBeGreaterThan(0);
  expect(ink.right).toBeGreaterThan(0);
  expect(ink.error).toBe(0);
  await page.waitForTimeout(150);
  expect(printed.equals(await canvas.screenshot(fieldOnly))).toBe(true);
  await page.screenshot({ path: info.outputPath("full-ascii-desktop.png") });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => printed.equals(await canvas.screenshot(fieldOnly))).toBe(false);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type === "webgl" ? null : original.call(this, type as "2d", ...args);
    } as typeof original;
  });
  await page.reload();
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "fallback");
  await expect(page.locator(".fallback")).toBeVisible();
  await expect(heading).toHaveCSS("font-family", '"Climate Crisis", sans-serif');
});

test("desktop: about me retains regular justified copy and the bold index at the top left", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const about = page.getByRole("region", { name: "about me", exact: true });
    await expect(about.getByRole("heading", { name: "about me", exact: true })).toBeVisible();
    await expect(about.getByRole("heading")).toHaveCSS("border-top-width", "0px");
    await expect(about).toContainText("Lorem ipsum");
    for (const paragraph of await about.locator("p").all()) {
      await expect(paragraph).toHaveCSS("text-align", "justify");
      await expect(paragraph).toHaveCSS("text-transform", "uppercase");
      await expect(paragraph).toHaveCSS("font-weight", "400");
      await expect(paragraph).toHaveCSS("font-size", "14px");
    }
    const column = (await about.boundingBox())!;
    const title = (await page.getByRole("heading", { name: "Mark Duek", exact: true }).boundingBox())!;
    expect(column.x).toBeCloseTo(viewport.width * 0.05, 1);
    expect(column.y).toBe(64);
    expect(column.x + column.width).toBeLessThan(title.x);
    expect(column.width).toBeLessThanOrEqual(416);
    expect(column.height).toBeLessThan(450);
    await page.screenshot({ path: info.outputPath(`about-${viewport.width}.png`) });
  }
});
