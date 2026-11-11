/**
 * pnpm db:preview:bootstrap-admin [--dry-run|--apply] [--json]
 *
 * Verifies (default) or sets (`--apply`) the password of the existing Preview admin
 * `preview@preview.com` from `PLAYWRIGHT_HOST_PASSWORD` in `.env.e2e.local`, and makes
 * sure it keeps the `super_admin` role. The password is loaded inside this process and
 * only travels over psql stdin; it is never printed. Production is always rejected.
 */

import { loadPlaywrightEnvironment } from '../playwright/preview-environment.ts';
import { resolvePreviewOnlyDbUrl } from '../provision/preview-db-target.ts';
import { authorizePreviewWriteApply } from '../provision/preview-write-auth.ts';
import { runPsql } from './db-workflow-lib.ts';
import {
	PREVIEW_ADMIN_BOOTSTRAP_OPERATION,
	PREVIEW_ADMIN_BOOTSTRAP_SCOPE,
	PREVIEW_ADMIN_BOOTSTRAP_SLUG,
	assertPreviewAdminBootstrapDbTarget,
	buildPreviewAdminApplySql,
	buildPreviewAdminStatusSql,
	isPreviewAdminReady,
	parsePreviewAdminBootstrapArgs,
	parsePreviewAdminStatus,
	requirePreviewAdminCredentials,
	type PreviewAdminStatus,
} from './preview-admin-bootstrap-guards.ts';
import { resolvePreviewAdminUser } from './preview-sync-guards.ts';

const HELP = `Usage: pnpm db:preview:bootstrap-admin [--dry-run|--apply] [--json]

Verifies or sets the Preview admin (preview@preview.com) password from
PLAYWRIGHT_HOST_PASSWORD in .env.e2e.local. The DB comes from PREVIEW_DB_URL
(.env.preview.local). Never creates users; never targets Production.

  --dry-run  Default. Read-only status check.
  --apply    Set the password and super_admin role. Non-TTY runs require
             CELEBRA_TASK_SCOPE=${PREVIEW_ADMIN_BOOTSTRAP_SCOPE}; a TTY asks for YES.
  --json     Print the result as JSON.`;

function readStatus(dbUrl: string, userId: string, password: string): PreviewAdminStatus {
	const result = runPsql(buildPreviewAdminStatusSql(userId, password), dbUrl, [password]);
	return parsePreviewAdminStatus(result.stdout);
}

function report(json: boolean, payload: Record<string, unknown>): void {
	if (json) {
		console.info(JSON.stringify(payload));
		return;
	}
	console.info('Preview admin bootstrap');
	for (const [key, value] of Object.entries(payload)) console.info(`- ${key}: ${String(value)}`);
}

async function main(): Promise<void> {
	const args = parsePreviewAdminBootstrapArgs(process.argv.slice(2));
	if (args.help) {
		console.info(HELP);
		return;
	}

	loadPlaywrightEnvironment();
	const { email, password } = requirePreviewAdminCredentials(process.env);
	const dbUrl = resolvePreviewOnlyDbUrl({
		errorPrefix: 'PREVIEW_ADMIN_BOOTSTRAP',
		purpose: 'bootstrap the Preview admin',
	});
	const projectRef = assertPreviewAdminBootstrapDbTarget(dbUrl);
	const userId = resolvePreviewAdminUser(dbUrl);
	const before = readStatus(dbUrl, userId, password);

	if (!args.apply) {
		report(args.json, {
			mode: 'dry-run',
			projectRef,
			email,
			userId,
			...before,
			ready: isPreviewAdminReady(before),
			next: isPreviewAdminReady(before)
				? 'none'
				: `CELEBRA_TASK_SCOPE=${PREVIEW_ADMIN_BOOTSTRAP_SCOPE} pnpm db:preview:bootstrap-admin --apply`,
		});
		return;
	}

	await authorizePreviewWriteApply({
		slug: PREVIEW_ADMIN_BOOTSTRAP_SLUG,
		operation: PREVIEW_ADMIN_BOOTSTRAP_OPERATION,
		confirmPrompt: `Escriba YES para fijar la contraseña y el rol super_admin de ${email} en Preview (${projectRef}): `,
	});
	runPsql(buildPreviewAdminApplySql(userId, password), dbUrl, [password]);
	const after = readStatus(dbUrl, userId, password);
	if (!isPreviewAdminReady(after)) {
		throw new Error(
			'PREVIEW_ADMIN_BOOTSTRAP_VERIFY: Preview admin is still not ready after apply.',
		);
	}
	report(args.json, { mode: 'apply', projectRef, email, userId, ...after, ready: true });
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	const secret = process.env.PLAYWRIGHT_HOST_PASSWORD;
	console.error(secret ? message.replaceAll(secret, '[REDACTED]') : message);
	process.exit(1);
});
