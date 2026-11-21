import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // No CI, sem retries: os testes E2E são informativos (continue-on-error no workflow)
  // e retries com expect() falhando apenas prolongam o job.
  retries: 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  use: {
    // Usar 127.0.0.1 explicitamente: "localhost" pode resolver para IPv6 (::1)
    // enquanto o Vite escuta apenas em IPv4, causando timeout no CI.
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: isCI
    ? // No CI, limitar a Chromium para evitar baixar/rodar 3 engines (/firefox/webkit).
      [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
        { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
      ],
  // Sempre iniciar o servidor de teste (inclusive no CI), senão os testes
  // tentam acessar localhost:5173 sem nada rodando e expiram por timeout.
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
  },
  timeout: isCI ? 15 * 1000 : 30 * 1000,
});
