import { test, expect } from "@playwright/test";

test.describe("Workflow submission and analysis flow", () => {
  test("submit workflow, view results, and export PDF", async ({ page }) => {
    // Step 1: Navigate to home page
    await page.goto("/");

    // Step 2: If auth gate appears (login redirect), enter password
    // The app uses AUTH_PASSWORD env var. Check if login page appears.
    const loginInput = page.locator('input[type="password"]');
    if (await loginInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginInput.fill("test-password");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL("/", { timeout: 5000 });
    }

    // Step 3: Enter workflow description in the textarea
    // The home page has a textarea for workflow description (min 20 chars required)
    const descriptionInput = page.locator("textarea").first();
    await expect(descriptionInput).toBeVisible({ timeout: 10000 });
    await descriptionInput.fill(
      "Customer onboarding process: receive application, verify identity, set up account, send welcome email, schedule kickoff call."
    );

    // Step 4: Submit the workflow by clicking "Decompose Workflow" button
    const submitButton = page.locator('button:has-text("Decompose Workflow")');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 5: Wait for SSE processing to complete and redirect to /xray/[id]
    // The MOCK_CLAUDE toggle returns instantly, so this should be fast
    await page.waitForURL(/\/xray\//, { timeout: 30000 });

    // Step 6: Verify results page loaded with title
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Step 7: Verify key result elements are present
    // The mock decompose response has 3 steps and 2 gaps
    await expect(page.locator("text=/\\d+ steps/")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=/\\d+ gaps/")).toBeVisible({ timeout: 5000 });

    // Step 8: Verify a tab panel is visible (flow map tab is default)
    await expect(page.locator('[role="tabpanel"]')).toBeVisible({ timeout: 5000 });

    // Step 9: Test PDF export
    // Click the "Download PDF" button and verify a download is triggered
    const pdfButton = page.locator('button:has-text("Download PDF")');
    await expect(pdfButton).toBeVisible({ timeout: 5000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await pdfButton.click();
    const download = await downloadPromise;

    // Verify download happened with a PDF filename
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
