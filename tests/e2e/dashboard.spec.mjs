import { expect, test } from "@playwright/test";

test.describe("dashboard smoke", () => {
  test("loads the core dashboard panels and default mock fund", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Advanced Stock Stalker" })).toBeVisible();
    await expect(page.getByText("Prospect Queue")).toBeVisible();
    await expect(page.getByText("ETF Comparison Matrix")).toBeVisible();
    await expect(page.getByText("Directional Thesis")).toBeVisible();
    await expect(page.getByText("Recent Signal Feed")).toBeVisible();
    await expect(page.getByText("Chart Settings")).toBeVisible();
    await expect(page.getByText("Workspace Layout")).toBeVisible();
    await expect(page.getByRole("button", { name: "1Y" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Live pulse" })).toBeVisible();
    await expect(page.getByText("Vanguard S&P 500 ETF").first()).toBeVisible();
  });

  test("can focus the chart and collapse secondary panels", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("workspace-layout")).toHaveAttribute("data-ready", "true");

    await page.getByTestId("workspace-size-max").click();

    await expect(page.getByText("Prospect Queue")).toBeHidden();
    await expect(page.getByText("Directional Thesis")).toBeHidden();
    await expect(page.locator('svg[aria-label^="VOO"]').first()).toBeVisible();

    await page.getByTestId("workspace-size-focus").click();
    await page.getByRole("button", { name: "Research", exact: true }).click();

    await expect(page.getByText("Directional Thesis")).toBeHidden();
  });

  test("searches for a mock instrument and promotes the first result", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Search VOO, XEQT, QQQM, VXUS...").fill("vxus");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText("Vanguard Total International Stock ETF").first()).toBeVisible();
    await expect(page.getByText("International developed and emerging equity").first()).toBeVisible();
  });

  test("keeps cited research context visible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("For research only.")).toBeVisible();
    await expect(page.getByText("S&P 500 funds see steady inflows").first()).toBeVisible();
    await expect(page.locator('a[href="https://example.com/sp500-fund-flows"]')).toBeVisible();
  });
});
