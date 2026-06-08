import { expect, test } from "@playwright/test";

test.describe("dashboard smoke", () => {
  test("loads the core dashboard panels and default mock fund", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Advanced Stock Stalker" })).toBeVisible();
    await expect(page.getByText("Stock List")).toBeVisible();
    await expect(page.getByText("Compare Funds", { exact: true })).toBeVisible();
    await expect(page.getByText("News plus a plain-English view.")).toBeVisible();
    await expect(page.getByText("Recent News")).toBeVisible();
    await expect(page.getByText("Chart Settings")).toBeVisible();
    await expect(page.getByText("Layout")).toBeVisible();
    await expect(page.getByTestId("portfolio-tracker")).toContainText("Portfolio Tracker");
    await expect(page.getByTestId("portfolio-tracker")).toContainText("Market Value");
    await expect(page.getByTestId("tracker-alerts")).toContainText("Alert Center");
    await expect(page.getByRole("button", { name: "1Y" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Live pulse" })).toBeVisible();
    await expect(page.getByText("Vanguard S&P 500 ETF").first()).toBeVisible();
  });

  test("can focus the chart and collapse secondary panels", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("workspace-layout")).toHaveAttribute("data-ready", "true");

    await page.getByTestId("workspace-size-max").click();

    await expect(page.getByText("Stock List")).toBeHidden();
    await expect(page.getByText("News plus a plain-English view.")).toBeHidden();
    await expect(page.locator('svg[aria-label^="VOO"]').first()).toBeVisible();

    await page.getByTestId("workspace-size-focus").click();
    await page.getByTestId("panel-chip-research").click();

    await expect(page.getByText("News plus a plain-English view.")).toBeHidden();
  });

  test("shows CAD chart details on hover and updates the active range", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("workspace-layout")).toHaveAttribute("data-ready", "true");

    const chartPanel = page.getByTestId("price-chart-panel");
    await chartPanel.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
    const firstBox = await chartPanel.boundingBox();
    expect(firstBox).not.toBeNull();
    await page.mouse.move(firstBox.x + firstBox.width * 0.48, firstBox.y + firstBox.height * 0.42);

    await expect(page.getByTestId("chart-hover-card")).toBeVisible();
    await expect(page.getByTestId("chart-hover-card")).toContainText("Price in CAD");
    await expect(page.getByTestId("chart-hover-card")).toContainText("1Y range");
    await expect(page.getByText("High (CAD)")).toBeVisible();
    await expect(page.getByText("Low (CAD)")).toBeVisible();

    await page.getByRole("button", { name: "5Y" }).click();
    await chartPanel.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
    const secondBox = await chartPanel.boundingBox();
    expect(secondBox).not.toBeNull();
    await page.mouse.move(secondBox.x + secondBox.width * 0.55, secondBox.y + secondBox.height * 0.42);

    await expect(page.getByTestId("chart-hover-card")).toContainText("5Y range");
    await expect(page.getByText(/^5Y range:/)).toBeVisible();
  });

  test("can drag a panel into and out of the dock", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("workspace-layout")).toHaveAttribute("data-ready", "true");

    await page.getByTestId("panel-chip-research").dragTo(page.getByTestId("hidden-panel-dock"));

    await expect(page.getByText("News plus a plain-English view.")).toBeHidden();
    await expect(page.getByTestId("hidden-panel-dock").getByTestId("panel-chip-research")).toBeVisible();

    await page.getByTestId("panel-chip-research").dragTo(page.getByTestId("visible-panel-dock"));

    await expect(page.getByText("News plus a plain-English view.")).toBeVisible();
  });

  test("searches for a mock instrument and promotes the first result", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Search any ticker, like VOO or XEQT...").fill("vxus");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText("Vanguard Total International Stock ETF").first()).toBeVisible();
    await expect(page.getByText("International developed and emerging equity").first()).toBeVisible();
  });

  test("tracks positions and editable CAD alert bands", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("portfolio-tracker")).toContainText("VOO");

    await page.getByTestId("position-shares-input").fill("13");
    await page.getByTestId("position-cost-input").fill("650");
    await page.getByTestId("alert-low-input").fill("600");
    await page.getByTestId("alert-high-input").fill("780");

    await expect(page.getByTestId("portfolio-tracker")).toContainText("13");
    await expect(page.getByTestId("tracker-alerts")).toContainText("$600.00");
    await expect(page.getByTestId("tracker-alerts")).toContainText("$780.00");
  });

  test("keeps cited research context visible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("For research only.")).toBeVisible();
    await expect(page.getByText("S&P 500 funds see steady inflows").first()).toBeVisible();
    await expect(page.locator('a[href="https://example.com/sp500-fund-flows"]')).toBeVisible();
  });
});
