import { expect, test } from "@playwright/test";

test("unconfigured deployment explains the required setup", async ({ page }) => {
  await page.goto("#/login");
  await expect(page.getByRole("heading", { name: "Shipment updates from anywhere." })).toBeVisible();
  await expect(page.getByText("This deployment is not connected to Supabase.")).toBeVisible();
});

test("invalid customer token uses the generic unavailable state", async ({ page }) => {
  await page.goto("#/track/not-a-valid-token");
  await expect(page.getByRole("heading", { name: "Shipment link unavailable" })).toBeVisible();
});
