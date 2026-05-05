import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for `/login`. Extend this pattern for other routes (e.g. `TransferPage`, `DashboardPage`).
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly errorAlert: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: /sign in/i });
    this.errorAlert = page.getByRole('alert');
    this.registerLink = page.getByRole('link', { name: /create one/i });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async expectOnLoginPage() {
    await expect(this.page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  }

  /** Fill email + password and submit the form (does not wait for navigation). */
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  /** Full happy-path login and wait until the app shell shows the dashboard. */
  async loginAndWaitForDashboard(email: string, password: string) {
    await this.login(email, password);
    await this.expectDashboardVisible();
  }

  async expectDashboardVisible() {
    await expect(this.page.getByRole('heading', { name: /accounts/i })).toBeVisible();
  }

  async expectErrorAlert(match?: RegExp | string) {
    await expect(this.errorAlert).toBeVisible();
    if (match !== undefined) {
      await expect(this.errorAlert).toContainText(match);
    }
  }
}
