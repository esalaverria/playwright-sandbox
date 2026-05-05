import { expect, test } from '@playwright/test';
import { LoginPage } from './page-objects';

const aliceEmail = process.env.E2E_EMAIL ?? 'alice@example.com';
const alicePassword = process.env.E2E_PASSWORD ?? 'Test123!';
const bobEmail = process.env.E2E_BOB_EMAIL ?? 'bob@example.com';
const lockedEmail = process.env.E2E_LOCKED_EMAIL ?? 'carol@example.com';
const dupEmail = process.env.E2E_DUPLICATE_EMAIL ?? 'eve@example.com';

/** Parses formatted USD like `$1,234.56` to integer cents. */
function parseUsdToCents(text: string | null) {
  if (!text) return 0;
  const n = Number(text.replace(/[^0-9.-]/g, ''));
  return Math.round(n * 100);
}

test.describe('NorthPeak smoke', { tag: '@smoke' }, () => {
  test.describe('Authentication', { tag: '@auth' }, () => {
    test('login and see dashboard accounts', async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.loginAndWaitForDashboard(aliceEmail, alicePassword);
    });

    test('locked user cannot sign in', async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(lockedEmail, alicePassword);
      await login.expectErrorAlert(/account restricted/i);
    });

    test('register duplicate email shows error', async ({ page }) => {
      await page.goto('/register');
      await page.getByLabel('Full name').fill('Dup Test');
      await page.getByLabel('Email').fill(dupEmail);
      await page.getByLabel(/^Password \(min 8\)/).fill('Test12345!');
      await page.getByLabel('Confirm password').fill('Test12345!');
      await page.getByRole('button', { name: /register/i }).click();
      await expect(page.getByRole('alert')).toContainText(/email already registered/i);
    });

    test('signup new user', async ({ page }) => {
      const unique = `user.${Date.now()}@example.com`;
      await page.goto('/register');
      await page.getByLabel('Full name').fill('New User');
      await page.getByLabel('Email').fill(unique);
      await page.getByLabel(/^Password \(min 8\)/).fill('Test12345!');
      await page.getByLabel('Confirm password').fill('Test12345!');
      await page.getByRole('button', { name: /register/i }).click();
      await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible();
    });
  });

  test.describe('Transfers', { tag: '@transfer' }, () => {
    test('internal transfer between own accounts', async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.loginAndWaitForDashboard(aliceEmail, alicePassword);
      await page.goto('/transfer');
      const internalForm = page.locator('form[data-transfer-kind="internal"]');
      await expect(internalForm).toBeVisible();
      await internalForm.getByRole('combobox', { name: 'From' }).click();
      await page.getByRole('option', { name: /River checking/i }).click();
      await internalForm.getByRole('combobox', { name: 'To' }).click();
      await page.getByRole('option', { name: /Growth savings/i }).click();
      await internalForm.getByLabel('Amount (USD)').fill('10.00');
      await internalForm.getByRole('button', { name: /submit internal transfer/i }).click();
      await expect(page.getByRole('alert').filter({ hasText: /transfer posted/i })).toBeVisible();
    });

    test('peer transfer credits recipient checking balance', async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.loginAndWaitForDashboard(bobEmail, alicePassword);

      const bobCheckingCard = page.locator('a').filter({ has: page.getByRole('heading', { name: 'Checking', exact: true }) });
      const beforeCents = parseUsdToCents(await bobCheckingCard.locator('h5').textContent());

      await page.getByRole('button', { name: /logout/i }).click();
      await expect(page).toHaveURL(/\/login$/);

      await login.loginAndWaitForDashboard(aliceEmail, alicePassword);

      await page.goto('/transfer');
      const previewReady = page.waitForResponse((r) => r.url().includes('/recipients/preview') && r.ok());
      await page.getByRole('tab', { name: /send to someone/i }).click();
      await previewReady;

      await page.getByLabel(/From your account/).click();
      await page.getByRole('option', { name: /River checking/i }).click();

      await expect(page.getByLabel(/To their account/)).toBeEnabled();
      await page.getByLabel(/Amount \(USD\)/).fill('1.00');
      await page.getByRole('button', { name: /send money/i }).click();
      await expect(page.getByRole('alert').filter({ hasText: /^sent/i })).toBeVisible();

      await page.getByRole('button', { name: /logout/i }).click();
      await expect(page).toHaveURL(/\/login$/);

      await login.goto();
      await login.loginAndWaitForDashboard(bobEmail, alicePassword);

      const afterCents = parseUsdToCents(await bobCheckingCard.locator('h5').textContent());
      expect(afterCents).toBe(beforeCents + 100);
    });
  });
});
