import { test, expect } from "@playwright/test";
test("resident report reaches operations and returns with public updates", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Continue as resident", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Demo Resident" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "New report", exact: true }).click();
  await page
    .getByLabel("What happened?")
    .fill(
      "Water is leaking into the road from a burst pipe near the campus entrance.",
    );
  await page.getByRole("button", { name: "Prepare draft" }).click();
  await expect(page.getByLabel("Short title")).toHaveValue(
    "Water leak requiring attention",
  );
  await page.getByLabel("Address or landmark").fill("Campus main entrance");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm and submit" }).click();
  await expect(
    page.getByRole("heading", { name: "Report saved" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Track this report" }).click();
  await expect(
    page.getByRole("heading", { name: "Water leak requiring attention" }),
  ).toBeVisible();
  if (process.env.CIVICFIX_SCREENSHOT_DIR)
    await page.screenshot({
      path: process.env.CIVICFIX_SCREENSHOT_DIR + "/resident-report.png",
      fullPage: true,
    });
  const incidentURL = page.url();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue as manager", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Community report queue" }),
  ).toBeVisible();
  await page.goto(incidentURL);
  await page
    .getByLabel("Public update", { exact: true })
    .fill("Your report has been received.");
  await page
    .getByLabel("Internal note (staff only)")
    .fill("Private team scheduling note.");
  await page.getByLabel("Next status").selectOption("acknowledged");
  await page
    .getByRole("button", { name: "Update status", exact: true })
    .click();
  await expect(page.getByLabel("Next status")).not.toHaveValue("acknowledged");
  await page
    .getByRole("button", { name: "Assign report", exact: true })
    .click();
  await expect(
    page.getByLabel("Next status").locator('option[value="in_progress"]'),
  ).toHaveCount(1);
  for (const status of ["in_progress", "resolved"]) {
    await page.getByLabel("Next status").selectOption(status);
    await page
      .getByRole("button", { name: "Update status", exact: true })
      .click();
    await expect(page.getByLabel("Next status")).not.toHaveValue(status);
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue as resident", exact: true })
    .click();
  await page.goto(incidentURL);
  await expect(
    page.getByText("Your report has been received.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Private team scheduling note.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Manage report" }),
  ).toHaveCount(0);
});
test("mobile landing and protected screens remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  if (process.env.CIVICFIX_SCREENSHOT_DIR)
    await page.screenshot({
      path: process.env.CIVICFIX_SCREENSHOT_DIR + "/mobile-home.png",
      fullPage: true,
    });
  await page.goto("/operations");
  await expect(
    page.getByRole("alert").filter({ hasText: "Sign in to continue" }),
  ).toContainText("Sign in to continue");
});
