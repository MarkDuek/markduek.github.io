import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    terrainTest: {
      frames: number;
      time: number;
      velocity: number;
      strength: number;
      timeOverride?: number;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.terrainTest = { frames: 0, time: 0, velocity: 0, strength: 0 };
    const prototype = WebGLRenderingContext.prototype;
    const draw = prototype.drawArrays;
    prototype.drawArrays = function (...args) {
      window.terrainTest.frames++;
      return draw.apply(this, args);
    };
    const getLocation = prototype.getUniformLocation;
    const names = new Map<WebGLUniformLocation, string>();
    prototype.getUniformLocation = function (program, name) {
      const location = getLocation.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    const uniform1f = prototype.uniform1f;
    prototype.uniform1f = function (location, value) {
      if (location && names.get(location) === "u_time") {
        value = window.terrainTest.timeOverride ?? value;
        window.terrainTest.time = value;
      }
      if (location && names.get(location) === "u_strength") window.terrainTest.strength = value;
      return uniform1f.call(this, location, value);
    };
    const uniform4f = prototype.uniform4f;
    prototype.uniform4f = function (location, x, y, vx, vy) {
      if (location && names.get(location) === "u_pointer") {
        window.terrainTest.velocity = Math.hypot(vx, vy);
      }
      return uniform4f.call(this, location, x, y, vx, vy);
    };
  });
});

test("desktop: shader renders, animates, responds and relaxes without errors", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" || /GL_INVALID|shader.*error/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await expect.poll(() => page.evaluate(() => window.terrainTest.time)).toBeGreaterThan(0.6);
  const after = await canvas.screenshot({ path: info.outputPath("desktop.png") });
  expect(before.equals(after)).toBe(false);

  await page.mouse.move(180, 700);
  await page.mouse.move(620, 500, { steps: 12 });
  await expect.poll(() => page.evaluate(() => window.terrainTest.velocity)).toBeGreaterThan(0.1);
  await expect.poll(() => page.evaluate(() => window.terrainTest.velocity), { timeout: 6000 }).toBeLessThan(0.02);
  const error = await canvas.evaluate(element => (element as HTMLCanvasElement).getContext("webgl")!.getError());
  expect(error).toBe(0);
  expect(errors).toEqual([]);
  await expect(page.locator("body")).not.toContainText("Mark Duek");
});

test("hover pulls the surface at rest and releases with elastic relaxation", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  await page.evaluate(() => { window.terrainTest.timeOverride = 0; });
  await expect.poll(() => page.evaluate(() => window.terrainTest.time)).toBe(0);
  const before = await page.locator("canvas").screenshot();

  await page.mouse.move(900, 650);
  await page.mouse.move(1080, 410, { steps: 8 });
  await expect.poll(() => page.evaluate(() => window.terrainTest.velocity)).toBeGreaterThan(0.1);
  await page.screenshot({ path: info.outputPath("pulling.png") });
  await expect.poll(() => page.evaluate(() => window.terrainTest.velocity)).toBeLessThan(0.01);
  expect(await page.evaluate(() => window.terrainTest.strength)).toBeGreaterThan(0.99);
  const held = await page.locator("canvas").screenshot({ path: info.outputPath("hover-held.png") });
  expect(before.equals(held)).toBe(false);

  await page.mouse.move(-20, 410);
  await expect.poll(() => page.evaluate(() => window.terrainTest.strength), { timeout: 6000 }).toBeLessThan(0.01);
  for (const seconds of [12, 24]) {
    await page.evaluate(value => { window.terrainTest.timeOverride = value; }, seconds);
    await expect.poll(() => page.evaluate(() => window.terrainTest.time)).toBe(seconds);
    await page.screenshot({ path: info.outputPath(`outward-${seconds}s.png`) });
  }
});

test("the initial terrain composition stays consistent across reloads", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  const first = await page.locator("canvas").screenshot();
  await page.reload();
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  const second = await page.locator("canvas").screenshot();
  expect(first.equals(second)).toBe(true);
});

test("mobile: resolution cap, resizing and touch do not block scrolling", async ({ browser }, info) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  const size = await page.locator("canvas").evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    return { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth };
  });
  expect(size.cssWidth).toBe(390);
  expect(size.width).toBeLessThanOrEqual(585);
  expect(size.width * size.height).toBeLessThanOrEqual(1_500_000);
  await page.screenshot({ path: info.outputPath("mobile.png") });

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(canvas => canvas.clientWidth)).toBe(844);
  await page.screenshot({ path: info.outputPath("mobile-landscape.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const content = document.createElement("div");
    content.style.height = "150vh";
    document.body.append(content);
  });
  const session = await context.newCDPSession(page);
  const touchStrength = () => page.locator("canvas").evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext("webgl")!;
    const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
    return gl.getUniform(program, gl.getUniformLocation(program, "u_strength")!) as number;
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart", touchPoints: [{ x: 200, y: 700 }],
  });
  await expect.poll(touchStrength).toBeGreaterThan(0.2);
  for (let y = 650; y >= 200; y -= 50) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove", touchPoints: [{ x: 200, y }],
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect.poll(touchStrength, { timeout: 6000 }).toBeLessThan(0.01);
  await context.close();
});

test("reduced motion renders a still frame, including after pointer input", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  const before = await page.locator("canvas").screenshot();
  await page.mouse.move(100, 500);
  await page.mouse.move(500, 300, { steps: 5 });
  await page.waitForTimeout(250);
  const after = await page.locator("canvas").screenshot();
  expect(before.equals(after)).toBe(true);
  expect(await page.evaluate(() => window.terrainTest.time)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => page.evaluate(() => window.terrainTest.time)).toBeGreaterThan(0);
});

test("hidden pages stop rendering and resume without a time jump", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const paused = await page.evaluate(() => ({ ...window.terrainTest }));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.terrainTest.frames)).toBe(paused.frames);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.evaluate(() => window.terrainTest.frames)).toBeGreaterThan(paused.frames);
  expect(await page.evaluate(() => window.terrainTest.time)).toBeLessThan(paused.time + 0.2);
});

test("WebGL unavailable or JavaScript disabled keeps the styled static landscape", async ({ page, browser }, info) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return getContext.call(this, type as "2d", ...args);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "fallback");
  await expect(page.locator(".fallback")).toBeVisible();
  await expect(page.locator("#topography")).toHaveCSS("background-color", "rgb(234, 232, 220)");
  await page.screenshot({ path: info.outputPath("fallback.png") });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noJS = await context.newPage();
  await noJS.goto("/");
  await expect(noJS.locator(".fallback")).toBeVisible();
  await context.close();
});
