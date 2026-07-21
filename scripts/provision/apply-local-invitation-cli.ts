#!/usr/bin/env node
/**
 * apply-local-invitation-cli.ts — CLI Entrypoint for Local Invitation Application
 *
 * Command alias:
 *   pnpm invitation:apply:local -- --slug romina-rios-chaparro --source-dir <PATH>
 *   pnpm invitation:apply:local -- --slug romina-rios-chaparro --source-dir <PATH> --apply
 */

import { applyLocalInvitation } from './apply-local-invitation.ts';
import { redactSecrets } from './romina/helpers.ts';

export function parseArgs(args = process.argv.slice(2)) {
	const dryRun = args.includes('--dry-run');
	const apply = args.includes('--apply');

	const slugIdx = args.indexOf('--slug');
	const slug = slugIdx >= 0 ? args[slugIdx + 1] : undefined;

	const sourceIdx = args.indexOf('--source-dir');
	const sourceDir = sourceIdx >= 0 ? args[sourceIdx + 1] : undefined;

	const ownerIdx = args.indexOf('--owner-user-id');
	const ownerUserId = ownerIdx >= 0 ? args[ownerIdx + 1] : undefined;

	if (!slug || !sourceDir) {
		console.error('\x1b[31mError: Missing required parameters.\x1b[0m\n');
		console.info('Usage:');
		console.info('  pnpm invitation:apply:local -- --slug <slug> --source-dir <photo-dir> [--dry-run]');
		console.info('  pnpm invitation:apply:local -- --slug <slug> --source-dir <photo-dir> --apply\n');
		process.exit(1);
	}

	return {
		slug,
		sourceDir,
		ownerUserId,
		dryRun: !apply || dryRun,
		isApply: apply,
	};
}

async function main() {
	const { slug, sourceDir, ownerUserId, isApply } = parseArgs();

	console.log(`\n\x1b[36m═══ Persistent-Local Invitation Application ═══\x1b[0m`);
	console.log(`Slug:       \x1b[1m${slug}\x1b[0m`);
	console.log(`Source Dir: \x1b[1m${sourceDir}\x1b[0m`);
	console.log(
		`Mode:       \x1b[1m${isApply ? 'APPLY (mutating persistent-local)' : 'DRY RUN (no writes)'}\x1b[0m\n`,
	);

	try {
		const result = await applyLocalInvitation({
			slug,
			sourceDir,
			ownerUserId,
			apply: isApply,
		});

		console.log(
			`\x1b[32m✅ Local invitation application ${isApply ? 'completed' : 'plan ready'}!\x1b[0m`,
		);
		console.log(`   Route:             \x1b[1m${result.route}\x1b[0m`);
		console.log(`   Target:            ${result.target} (127.0.0.1:54322)`);
		console.log(`   Invitation ID:     ${result.invitationId}`);
		console.log(`   Owner User ID:     ${result.ownerUserId}`);
		console.log(`   Published Version: v${result.publishedVersion}`);
		console.log(`   Planned Mutations: ${result.plannedMutations}`);
		console.log(`   Executed Mutations:${result.executedMutations}`);
		console.log(`   Zero-Drift:        ${result.isZeroDrift ? 'Yes' : 'No'}`);

		console.log('\n   Plan Actions:');
		for (const act of result.actions) {
			const icon = act.action === 'reuse' ? '✓' : act.action === 'create' ? '+' : '~';
			console.log(`     ${icon} [${act.resource}] ${act.name}: ${act.detail}`);
		}

		if (!isApply) {
			console.log(
				`\n   \x1b[33m[dry-run] Run with --apply to execute persistent-local writes.\x1b[0m\n`,
			);
		} else {
			console.log(`\n   \x1b[32m🎉 Local apply & publish complete! Route: ${result.route}\x1b[0m\n`);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`\n\x1b[31m❌ Local application failed:\x1b[0m ${redactSecrets(message)}\n`);
		process.exit(1);
	}
}

if (process.argv[1] && process.argv[1].includes('apply-local-invitation-cli')) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
