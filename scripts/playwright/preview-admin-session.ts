/**
 * pnpm preview:admin:session [--clear]
 *
 * Signs in to the hosted Preview dashboard as preview@preview.com with the Cloudflare
 * Access service token and PLAYWRIGHT_HOST_PASSWORD from `.env.e2e.local`, then saves a
 * Playwright storage state that agents can reuse (`browser.newContext({ storageState })`).
 * Only non-secret facts are printed. The storage state holds session cookies: never print
 * or commit it, and remove it with `--clear` when the task ends.
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
	PREVIEW_OUTPUT_ROOT,
	assertExpectedPreviewAccountEmail,
	assertExpectedPreviewAccountRole,
	loadPlaywrightEnvironment,
	validatePreviewTargetEnvironment,
} from './preview-environment.ts';
import { requirePreviewAdminCredentials } from '../db/preview-admin-bootstrap-guards.ts';

export const PREVIEW_ADMIN_STORAGE_STATE = `${PREVIEW_OUTPUT_ROOT}/preview-admin-session/storage-state.json`;

const LOGIN_TIMEOUT_MS = 30_000;

async function signIn(storageStatePath: string): Promise<Record<string, unknown>> {
	const runtime = validatePreviewTargetEnvironment(process.env);
	const { email, password } = requirePreviewAdminCredentials(process.env);
	const headers = runtime.protectionHeaders;
	if (!headers) throw new Error('Cloudflare Access service token headers were not resolved.');

	const { chromium } = await import('@playwright/test');
	const browser = await chromium.launch({ headless: true });
	try {
		const context = await browser.newContext({ baseURL: runtime.baseURL });
		const origin = new URL(runtime.baseURL).origin;
		// Same-origin only, so the Access token never reaches third-party assets.
		await context.route(
			(url) => url.origin === origin,
			(route) => route.continue({ headers: { ...route.request().headers(), ...headers } }),
		);
		const page = await context.newPage();
		page.setDefaultTimeout(LOGIN_TIMEOUT_MS);

		await page.goto('/login');
		await page.locator('#login-submit').waitFor({ state: 'visible' });
		const loginResponse = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === '/api/auth/login-host' &&
				response.request().method() === 'POST',
		);
		await page.locator('#login-email').fill(email);
		await page.locator('#login-password').fill(password);
		await page.locator('#login-submit').click();
		const status = (await loginResponse).status();
		if (status !== 200) throw new Error(`Preview login failed with HTTP ${status}.`);
		await page.waitForURL(/\/dashboard\//);
		await page.locator('.dashboard-env-banner--preview').waitFor({ state: 'visible' });

		const sessionResponse = await page.request.get(`${runtime.baseURL}/api/auth/session`, {
			headers,
		});
		if (sessionResponse.status() !== 200) {
			throw new Error(`Session check failed with HTTP ${sessionResponse.status()}.`);
		}
		const session = (await sessionResponse.json()) as Record<string, unknown>;
		assertExpectedPreviewAccountEmail(String(session.email ?? ''));
		assertExpectedPreviewAccountRole(String(session.role ?? ''));

		mkdirSync(dirname(storageStatePath), { recursive: true });
		await context.storageState({ path: storageStatePath });
		return {
			ok: true,
			baseURL: runtime.baseURL,
			email: session.email,
			role: session.role,
			storageState: PREVIEW_ADMIN_STORAGE_STATE,
		};
	} finally {
		await browser.close();
	}
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const unknown = argv.filter((arg) => arg !== '--clear');
	if (unknown.length > 0) throw new Error(`Unknown argument "${unknown[0]}".`);
	const storageStatePath = resolve(process.cwd(), PREVIEW_ADMIN_STORAGE_STATE);

	if (argv.includes('--clear')) {
		const existed = existsSync(storageStatePath);
		rmSync(storageStatePath, { force: true });
		console.info(JSON.stringify({ ok: true, cleared: existed }));
		return;
	}

	loadPlaywrightEnvironment();
	console.info(JSON.stringify(await signIn(storageStatePath)));
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	const secret = process.env.PLAYWRIGHT_HOST_PASSWORD;
	console.error(secret ? message.replaceAll(secret, '[REDACTED]') : message);
	process.exit(1);
});
