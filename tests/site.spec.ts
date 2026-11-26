import { expect, test } from "@playwright/test";

test("homepage, shader, and Amazon project pages are available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mark Duek" })).toBeVisible();
  await expect(page.locator("#topography")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#terrain-canvas")).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about/");
  await expect(navigation.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "#projects");
  await expect(navigation.getByRole("link", { name: "Curriculum Vitae" })).toHaveAttribute("href", "/cv/");
  await navigation.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/#projects$/);

  await expect(page.getByRole("link", { name: /Anomaly Detection Benchmark/ }))
    .toHaveAttribute("href", "https://markduek.github.io/mark-anomaly-detection-benchmark/");

  for (const [path, heading] of [
    ["/projects/deforestation-forecasting/", /Deep Learning Model for Deforestation Prediction/],
    ["/projects/lightweight-neural-networks/", /Lightweight Neural Networks for Deforestation Prediction/],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});
