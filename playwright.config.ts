import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      MOCK_CLAUDE: "true",
      ALLOW_MEMORY_STORAGE: "true",
      ANTHROPIC_API_KEY: "mock-key-for-testing",
      AUTH_PASSWORD: "test-password",
    },
  },
});
