/**
 * invitation-id-purge-cli.ts — Dry-run / apply CLI for ID-scoped Preview invitation purge.
 *
 * Usage:
 *   pnpm invitation:purge-by-id -- --incorrect-id <uuid> --canonical-id <uuid> \
 *     --expect-incorrect-slug <slug> --expect-canonical-slug <slug> \
 *     --allow-archived-inconsistent-source --dry-run
 */

import {
	INVITATION_ID_PURGE_OPERATION,
	runInvitationIdPurge,
} from './invitation-id-purge.ts';

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function printHelp(): void {
	console.log(`invitation:purge-by-id — Preview invitation purge by immutable UUID

Usage:
  pnpm invitation:purge-by-id -- --incorrect-id <uuid> --canonical-id <uuid> \\
    --expect-incorrect-slug <slug> --expect-canonical-slug <slug> \\
    --allow-archived-inconsistent-source --dry-run
  pnpm invitation:purge-by-id -- ... --apply

Required:
  --incorrect-id / --canonical-id
  --expect-incorrect-slug / --expect-canonical-slug
  --allow-archived-inconsistent-source   (source must already be archived)
  exactly one of --dry-run or --apply

Optional:
  --resume-storage-cleanup   (DB already absent; set CELEBRA_PURGE_RESUME_STORAGE_PATHS)
  --json

Rules:
  - Identifies invitations by UUID + exact slug assertions (never by display name).
  - Accepts only a genuinely archived inconsistent source.
  - Blocks unresolved claim codes and non-synthetic guests.
  - Verifies Storage ownership under managed/<incorrect-slug>/ and asset hash equivalence.
  - Apply: DB transaction, then Storage cleanup; append-only receipt; resumable residuals.
  - Production is rejected.
  - Automated --apply requires CELEBRA_TASK_SCOPE=preview:<incorrect-slug>:${INVITATION_ID_PURGE_OPERATION}
`);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
	if (argv.includes('--help') || argv.includes('-h')) {
		printHelp();
		return;
	}

	const incorrectId = value(argv, '--incorrect-id');
	const canonicalId = value(argv, '--canonical-id');
	const expectIncorrectSlug = value(argv, '--expect-incorrect-slug');
	const expectCanonicalSlug = value(argv, '--expect-canonical-slug');
	const apply = argv.includes('--apply');
	const dryRun = argv.includes('--dry-run');
	const jsonMode = argv.includes('--json');

	if (!incorrectId || !canonicalId || !expectIncorrectSlug || !expectCanonicalSlug || apply === dryRun) {
		throw new Error(
			'Usage requires --incorrect-id, --canonical-id, --expect-incorrect-slug, --expect-canonical-slug, and exactly one of --dry-run or --apply.',
		);
	}

	const isInteractive = process.stdin.isTTY === true && !process.env.CI;
	const audit = await runInvitationIdPurge({
		incorrectInvitationId: incorrectId,
		canonicalInvitationId: canonicalId,
		expectIncorrectSlug,
		expectCanonicalSlug,
		allowArchivedInconsistentSource: argv.includes('--allow-archived-inconsistent-source'),
		resumeStorageCleanup: argv.includes('--resume-storage-cleanup'),
		apply: apply && !dryRun,
		isInteractive,
	});

	if (jsonMode) {
		console.log(JSON.stringify(audit, null, 2));
	} else {
		console.log(`Invitation ID purge (${audit.mode})`);
		console.log(`  environment:     ${audit.environment}`);
		console.log(`  target:          ${audit.dbUrlRedacted}`);
		console.log(`  incorrect:       ${audit.incorrect.id}  slug=${audit.incorrect.slug}`);
		console.log(`  canonical:       ${audit.canonical.id}  slug=${audit.canonical.slug}`);
		console.log(`  migration needed:${audit.migration.required ? ' YES' : ' no'}`);
		console.log(`  blocked:         ${audit.blocked ? 'YES' : 'no'}`);
		console.log(`  deletion result: ${audit.deletionResult}`);
		if (audit.blockReasons.length > 0) {
			console.log('  block reasons:');
			for (const reason of audit.blockReasons) console.log(`    - ${reason}`);
		}
		console.log('  incorrect dependency counts:');
		for (const [key, count] of Object.entries(audit.incorrectDependencies)) {
			console.log(`    - ${key}: ${count}`);
		}
		if (audit.auditArtifactPath) {
			console.log(`  audit artifact:  ${audit.auditArtifactPath}`);
		}
		if (audit.mode === 'dry_run' && !audit.blocked) {
			console.log('\nDry-run only. Re-run with --apply after explicit confirmation.');
		}
	}

	if (audit.blocked || audit.deletionResult === 'rolled_back') {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exitCode = 1;
});
