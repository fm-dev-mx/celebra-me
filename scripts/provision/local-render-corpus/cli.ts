/**
 * Local Render Corpus bootstrap CLI — persistent-local only.
 *
 *   pnpm invitation:local-corpus --dry-run
 *   pnpm invitation:local-corpus --apply
 *   pnpm invitation:local-corpus --apply --slug abril-michelle-becerra-rea
 */
import { bootstrapLocalRenderCorpus } from './bootstrap.ts';
import { assertLocalRenderCorpusIntegrity, listLocalRenderCorpus } from './registry.ts';

function printHelp(): void {
	console.log(`Local Render Corpus bootstrap (persistent-local only)

Usage:
  pnpm invitation:local-corpus --dry-run
  pnpm invitation:local-corpus --apply
  pnpm invitation:local-corpus --dry-run|--apply [--slug <slug>]...

Populates the 14 supported Production client invitations for Local render regression.
Canonical entries use invitation:update Local apply.
Legacy entries upsert sanitized invitations + published_invitation_content only.

Never targets Preview or Production. Never clones databases. Never imports guests/Auth/RSVP.
`);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.includes('--help') || args.includes('-h')) {
		printHelp();
		return;
	}

	assertLocalRenderCorpusIntegrity();

	const dryRun = args.includes('--dry-run');
	const apply = args.includes('--apply');
	if (dryRun === apply) {
		console.error('Specify exactly one of --dry-run or --apply.');
		process.exit(1);
	}

	const slugs: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--slug') {
			const value = args[i + 1];
			if (!value) {
				console.error('--slug requires a value.');
				process.exit(1);
			}
			slugs.push(value);
			i++;
		}
	}

	console.log(
		`Local Render Corpus ${apply ? 'APPLY' : 'DRY-RUN'} (${slugs.length ? slugs.join(', ') : `${listLocalRenderCorpus().length} entries`})`,
	);

	const result = await bootstrapLocalRenderCorpus({
		mode: apply ? 'apply' : 'dry-run',
		slugs: slugs.length ? slugs : undefined,
	});

	for (const entry of result.entries) {
		console.log(
			`  [${entry.action}] ${entry.slug} (${entry.classification}) — ${entry.detail}`,
		);
	}
	console.log(`Done. target=${result.target} mode=${result.mode}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
