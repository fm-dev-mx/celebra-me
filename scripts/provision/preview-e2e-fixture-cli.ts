/**
 * preview-e2e-fixture-cli.ts — Preview-only E2E fixture bootstrap CLI
 *
 * Usage:
 *   pnpm invitation:preview-fixture --dry-run
 *   pnpm invitation:preview-fixture --apply
 *   CELEBRA_TASK_SCOPE=preview:e2e-preview-publication:e2e-fixture pnpm invitation:preview-fixture --apply
 */

import { ensurePreviewE2eFixture, PREVIEW_E2E_FIXTURE_OPERATION } from './preview-e2e-fixture.ts';
import { PREVIEW_FIXTURE_SLUG } from '../playwright/preview-environment.ts';

function printHelp(): void {
	console.log(`Preview E2E fixture bootstrap (Preview-only; read plan with --dry-run)

Usage:
  pnpm invitation:preview-fixture --dry-run
  pnpm invitation:preview-fixture --apply

Creates or verifies slug "${PREVIEW_FIXTURE_SLUG}" owned by preview@preview.com.
Does not restore Dashboard/API invitation creation.
Production is rejected.

Automated --apply requires:
  CELEBRA_TASK_SCOPE=preview:${PREVIEW_FIXTURE_SLUG}:${PREVIEW_E2E_FIXTURE_OPERATION}

After apply, set PLAYWRIGHT_PREVIEW_INVITATION_ID to the printed UUID, then run:
  pnpm test:e2e:preview:provision
`);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.includes('--help') || args.includes('-h')) {
		printHelp();
		return;
	}

	const apply = args.includes('--apply');
	const dryRun = args.includes('--dry-run') || !apply;
	if (apply && args.includes('--dry-run')) {
		throw new Error('Pass either --apply or --dry-run, not both.');
	}

	const jsonMode = args.includes('--json');
	const isInteractive = process.stdin.isTTY === true && !process.env.CI;

	const result = ensurePreviewE2eFixture({
		apply: apply && !dryRun,
		isInteractive,
	});

	if (jsonMode) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	console.log(`Preview E2E fixture: ${result.action}`);
	console.log(`  slug:           ${result.slug}`);
	console.log(`  invitation id:  ${result.invitationId}`);
	console.log(`  owner:          ${result.ownerUserId}`);
	console.log(`  target:         ${result.dbUrlRedacted}`);
	if (result.action === 'created' || result.action === 'already_present') {
		console.log(`\nSet PLAYWRIGHT_PREVIEW_INVITATION_ID=${result.invitationId}`);
		console.log('Then run: pnpm test:e2e:preview:provision');
	} else if (result.action === 'dry_run_create') {
		console.log('\nDry-run only. Re-run with --apply to create the fixture.');
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exitCode = 1;
});
